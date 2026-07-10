/**
 * session.service.js —— 专注会话业务逻辑层
 *
 * 职责：
 *   1. session/complete — 完成一个专注会话，同时更新日汇总和关联任务
 *   2. session/list     — 分页查询历史会话（支持日期范围筛选）
 *
 * 依赖:
 *   - SessionRepo        (sessions 集合 CRUD)
 *   - DailySummaryRepo   (daily_summaries 预聚合 upsert)
 *   - 云函数 SDK          (task 更新，因 task.repo.js 尚未实现)
 *
 * 契约: docs/api-contracts.md §3
 * 参考: docs/issues/02-session-module.md
 */

const SessionRepo = require('../repositories/session.repo');
const DailySummaryRepo = require('../repositories/daily-summary.repo');
const { getDb } = require('../utils/cloud');
const { getDateStr } = require('../utils/helpers');

class SessionService {

  /**
   * @param {SessionRepo} sessionRepo
   * @param {DailySummaryRepo} dailySummaryRepo
   */
  constructor(sessionRepo, dailySummaryRepo) {
    this.sessionRepo = sessionRepo;
    this.dailySummaryRepo = dailySummaryRepo;
  }

  /**
   * 工厂方法 —— 自动组装依赖链
   * @returns {SessionService}
   */
  static create() {
    return new SessionService(SessionRepo.create(), DailySummaryRepo.create());
  }

  // ═══════════════════════════════════════════════════
  //  session/complete
  // ═══════════════════════════════════════════════════

  /**
   * 完成一个专注会话
   *
   * 流程:
   *   0. P0-2: 幂等键检查，防止重复提交
   *   1. 构建 session 文档并插入
   *   2. 如果是番茄钟（focus + isPomodoro），更新当日汇总
   *   3. 如果关联了 taskId，递增任务的 completedPomodoros
   *   4. 查询当日所有会话，计算累计统计
   *   5. 🆕 不阻塞的异步 aiScore 写入（评分失败不影响主流程）
   *
   * P0-1: 步骤 2-3 失败时补偿删除步骤 1 的 session 记录，保证数据一致性。
   * P1-2: 步骤 3 递增后重新查询真实值，避免并发场景返回值不准。
   *
   * @param {string} openId
   * @param {{ mode: string, duration: number, taskId?: string, completedPomodoro?: boolean, idempotencyKey?: string }} params
   * @returns {Promise<{ session: object, task?: object, todayStats: object }>}
   */
  async completeSession(openId, { mode, duration, taskId, completedPomodoro, idempotencyKey }) {
    const now = Date.now();
    const completedAt = now;
    const startedAt = completedAt - duration * 1000;
    const isPomodoro = mode === 'focus' && completedPomodoro !== false;

    console.log('[Session.complete] 开始处理', { openId, mode, duration, taskId, isPomodoro, idempotencyKey });

    // ── 0. P0-2: 幂等键防重复 ──
    if (idempotencyKey) {
      console.log('[Session.complete] 步骤0: 幂等键检查');
      const existing = await this.sessionRepo.findByIdempotencyKey(openId, idempotencyKey);
      if (existing) {
        console.log('[Session.complete] 步骤0: 命中幂等键，直接返回已有记录');
        const todaySessions = await this.sessionRepo.getTodaySessions(openId);
        return {
          session: existing,
          todayStats: this._calcTodayStats(todaySessions),
          deduplicated: true,
        };
      }
    }

    // ── 1. 插入 session 记录 ──
    const sessionRecord = {
      _openid: openId,
      mode,
      duration,          // 秒
      startedAt,
      completedAt,
      taskId: taskId || null,
      isPomodoro,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
    };

    console.log('[Session.complete] 步骤1: 插入 session 记录', sessionRecord);
    const created = await this.sessionRepo.insert(sessionRecord);
    console.log('[Session.complete] 步骤1: 插入成功, _id =', created._id);

    // ── 2-3. 更新日汇总 + 任务（P0-1: 补偿模式） ──
    try {
      if (isPomodoro) {
        const dateStr = getDateStr();
        console.log('[Session.complete] 步骤2: upsert 日汇总', { openId, dateStr, focusMinutes: Math.round(duration / 60), pomodoroCount: 1 });
        await this.dailySummaryRepo.upsert(openId, dateStr, {
          focusMinutes: Math.round(duration / 60),
          pomodoroCount: 1,
        });
        console.log('[Session.complete] 步骤2: 日汇总 upsert 成功');
      }

      let task = null;
      if (taskId) {
        console.log('[Session.complete] 步骤3: 递增任务 pomodoro', { taskId });
        task = await this._incrementTaskPomodoros(taskId, openId);
        console.log('[Session.complete] 步骤3: 任务递增完成', task);
      }

      // ── 4. 当日累计统计 ──
      console.log('[Session.complete] 步骤4: 查询当日 sessions');
      const todaySessions = await this.sessionRepo.getTodaySessions(openId);
      const todayStats = this._calcTodayStats(todaySessions);
      console.log('[Session.complete] 步骤4: 统计完成', todayStats);

      // ── 5. 🆕 不阻塞的异步 aiScore 写入 ──
      if (isPomodoro) {
        this._updateAiScoreAsync(openId).catch(err => {
          console.warn('[Session.complete] aiScore 写入失败:', err.message);
        });
      }

      return {
        session: created,
        task: task || undefined,
        todayStats,
      };
    } catch (err) {
      // P0-1: 补偿——删除已插入的 session，保证数据一致性
      console.error('[SessionService.completeSession] 部分写入失败，执行补偿删除:', err.message);
      console.error('[SessionService.completeSession] 详细错误:', err);
      await this.sessionRepo.deleteById(created._id);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════
  //  session/list
  // ═══════════════════════════════════════════════════

  /**
   * 分页查询历史会话（支持日期范围筛选）
   *
   * @param {string} openId
   * @param {{ page?: number, pageSize?: number, startDate?: string, endDate?: string }} params
   * @returns {Promise<{ sessions: object[], total: number, hasMore: boolean }>}
   */
  async getSessions(openId, { page = 1, pageSize = 20, startDate, endDate } = {}) {
    const { sessions, total } = startDate || endDate
      ? await this._queryByDateRange(openId, startDate, endDate, { page, pageSize })
      : await this._queryAll(openId, { page, pageSize });

    return {
      sessions,           // 包含 _openid，由路由层按契约决定是否保留
      total,
      hasMore: page * pageSize < total,
    };
  }

  // ═══════════════════════════════════════════════════
  //  私有方法
  // ═══════════════════════════════════════════════════

  /**
   * 递增关联任务的 completedPomodoros
   *
   * P1-2: 递增后重新查询真实值，避免并发场景下基于旧值 +1 导致返回值不准。
   *
   * @private
   */
  async _incrementTaskPomodoros(taskId, openId) {
    const db = getDb();
    const _ = db.command;

    const taskRes = await db.collection('tasks').where({
      _id: taskId,
      _openid: openId,
    }).get();

    if (taskRes.data.length === 0) return null;

    await db.collection('tasks').doc(taskId).update({
      data: {
        completedPomodoros: _.inc(1),
        updatedAt: Date.now(),
      },
    });

    // P1-2: 更新后重新查询，获取数据库中的真实值
    const updated = await db.collection('tasks').doc(taskId).get();
    return {
      _id: taskId,
      completedPomodoros: updated.data.completedPomodoros || 0,
    };
  }

  /**
   * 计算并写入 Coach 评分到当日 daily_summaries
   *
   * 不阻塞主流程：调用方通过 .catch() 处理错误，不 throw。
   * CoachService 延迟加载，避免构造时循环依赖。
   *
   * @param {string} openId
   * @private
   */
  async _updateAiScoreAsync(openId) {
    const CoachService = require('./coach.service');
    const coach = CoachService.create();
    const { score } = await coach.getScore(openId);
    const dateStr = getDateStr();
    await this.dailySummaryRepo.updateAiScore(openId, dateStr, score);
  }

  /**
   * 按日期范围查询
   * @private
   */
  async _queryByDateRange(openId, startDate, endDate, pagination) {
    const [sessions, total] = await Promise.all([
      this.sessionRepo.findByDateRange(openId, startDate, endDate, pagination),
      this.sessionRepo.countByDateRange(openId, startDate, endDate),
    ]);
    return { sessions, total };
  }

  /**
   * 查询全部（仅按 openId）
   * @private
   */
  async _queryAll(openId, pagination) {
    const where = { _openid: openId };
    const [sessions, total] = await Promise.all([
      this.sessionRepo.findAll(where, pagination),
      this.sessionRepo.count(where),
    ]);
    return { sessions, total };
  }

  /**
   * 从当日会话列表累计统计
   * @private
   */
  _calcTodayStats(sessions) {
    let focusMinutes = 0;
    let pomodoroCount = 0;
    const taskIds = new Set();

    for (const s of sessions) {
      if (s.isPomodoro) {
        focusMinutes += Math.round(s.duration / 60);
        pomodoroCount += 1;
      }
      if (s.taskId) taskIds.add(s.taskId);
    }

    return {
      focusMinutes,
      pomodoroCount,
      completedTasks: taskIds.size,
    };
  }

}

module.exports = SessionService;
