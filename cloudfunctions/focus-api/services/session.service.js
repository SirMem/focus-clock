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
   *   1. 构建 session 文档并插入
   *   2. 如果是番茄钟（focus + isPomodoro），更新当日汇总
   *   3. 如果关联了 taskId，递增任务的 completedPomodoros
   *   4. 查询当日所有会话，计算累计统计
   *
   * @param {string} openId
   * @param {{ mode: string, duration: number, taskId?: string, completedPomodoro?: boolean }} params
   * @returns {Promise<{ session: object, task?: object, todayStats: object }>}
   */
  async completeSession(openId, { mode, duration, taskId, completedPomodoro }) {
    const now = Date.now();
    const completedAt = now;
    const startedAt = completedAt - duration * 1000;
    const isPomodoro = mode === 'focus' && completedPomodoro !== false;

    // ── 1. 插入 session 记录 ──
    const sessionRecord = {
      _openid: openId,
      mode,
      duration,          // 秒
      startedAt,
      completedAt,
      taskId: taskId || null,
      isPomodoro,
      createdAt: now,
    };

    const created = await this.sessionRepo.insert(sessionRecord);

    // ── 2. 如果是番茄钟，更新当日汇总 ──
    if (isPomodoro) {
      const dateStr = getDateStr();
      await this.dailySummaryRepo.upsert(openId, dateStr, {
        focusMinutes: Math.round(duration / 60),
        pomodoroCount: 1,
      });
    }

    // ── 3. 如果关联了 task，递增 completedPomodoros ──
    let task = null;
    if (taskId) {
      task = await this._incrementTaskPomodoros(taskId, openId);
    }

    // ── 4. 当日累计统计 ──
    const todaySessions = await this.sessionRepo.getTodaySessions(openId);
    const todayStats = this._calcTodayStats(todaySessions);

    return {
      session: created,
      task: task || undefined,
      todayStats,
    };
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

    return {
      _id: taskId,
      completedPomodoros: (taskRes.data[0].completedPomodoros || 0) + 1,
    };
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
