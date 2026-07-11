/**
 * stats.service.js —— 统计模块业务逻辑
 *
 * 提供今日/周/月统计 + 热力图数据的聚合计算。
 * 通过构造函数注入依赖（DailySummaryRepo, SessionRepo, CoachService），方便测试。
 *
 * P2-2: 周统计、月统计、热力图均改为一次范围查询，消除 N+1 逐日查询。
 *
 * 契约: docs/dev-specs/03-stats.md
 */

const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const TaskRepo = require('../repositories/task.repo');
const { getDateStr, getWeekStart, getMonthStr, getDaysInMonth } = require('../utils/helpers');

class StatsService {

  constructor(dailySummaryRepo, sessionRepo, coachService, taskRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
    this.coachService = coachService;
    this.taskRepo = taskRepo;
  }

  /**
   * 工厂方法
   * @returns {StatsService}
   */
  static create() {
    // CoachService 延迟加载，避免模块加载时的循环依赖
    const CoachService = require('./coach.service');
    return new StatsService(
      DailySummaryRepo.create(),
      SessionRepo.create(),
      CoachService.create(),
      TaskRepo.create(),
    );
  }

  /**
   * 获取今日统计数据
   *
   * 从 daily_summaries 集合中查询当日预聚合数据。
   * AI 评分优先用缓存值，缓存不存在时实时计算，确保统计页始终能展示。
   *
   * @param {string} openId
   * @returns {Promise<{focusMinutes: number, pomodoroCount: number, completedTasks: number, aiScore?: number}>}
   */
  async getTodayStats(openId) {
    const record = await this.dailySummaryRepo.findByDate(openId, getDateStr());

    if (!record) {
      return { focusMinutes: 0, pomodoroCount: 0, completedTasks: 0 };
    }

    // ⭐ AI 评分：先尝试读取缓存，没有则实时计算
    let aiScore = record.aiScore;
    if (aiScore == null) {
      try {
        const result = await this.coachService.getScore(openId);
        aiScore = result.score;
      } catch (err) {
        console.warn('[StatsService.getTodayStats] 实时算分失败:', err.message);
        // 实时算分失败时返回 undefined，前端展示"暂无数据"文案
      }
    }

    return {
      focusMinutes: record.focusMinutes || 0,
      pomodoroCount: record.pomodoroCount || 0,
      completedTasks: record.completedTasks || 0,
      aiScore,
    };
  }

  /**
   * 获取本周统计（周一 ~ 周日）
   *
   * P2-2: 一次范围查询替代 7 次逐日查询。
   *
   * @param {string} openId
   * @returns {Promise<{
   *   totalFocusMinutes: number,
   *   totalPomodoros: number,
   *   avgDailyFocus: number,
   *   activeDays: number,
   *   dailyBreakdown: Array<{date: string, focusMinutes: number, pomodoroCount: number}>
   * }>}
   */
  async getWeeklyStats(openId) {
    const weekStart = getWeekStart();

    // 计算周日日期（weekStart + 6 天）
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = getDateStr(weekEndDate);

    // P2-2: 一次查询获取 7 天数据
    const records = await this.dailySummaryRepo.findByDateRange(openId, weekStart, weekEnd);

    // 构建 date → record 映射表
    const dateMap = {};
    for (const r of records) {
      dateMap[r.date] = r;
    }

    const dailyBreakdown = [];
    let totalFocusMinutes = 0;
    let totalPomodoros = 0;
    let activeDays = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      const dateStr = getDateStr(date);
      const record = dateMap[dateStr];

      const focusMinutes = record ? (record.focusMinutes || 0) : 0;
      const pomodoroCount = record ? (record.pomodoroCount || 0) : 0;

      dailyBreakdown.push({ date: dateStr, focusMinutes, pomodoroCount });
      totalFocusMinutes += focusMinutes;
      totalPomodoros += pomodoroCount;
      if (focusMinutes > 0) activeDays++;
    }

    return {
      totalFocusMinutes,
      totalPomodoros,
      avgDailyFocus: Math.round(totalFocusMinutes / 7),
      activeDays,
      dailyBreakdown,
    };
  }

  /**
   * 获取本月统计
   *
   * P2-2: 一次范围查询替代 28-31 次逐日查询。
   *
   * @param {string} openId
   * @returns {Promise<{
   *   totalFocusMinutes: number,
   *   totalPomodoros: number,
   *   avgDailyFocus: number,
   *   activeDays: number,
   *   totalDays: number,
   *   completionRate: number
   * }>}
   */
  async getMonthlyStats(openId) {
    const monthStr = getMonthStr();
    const [year, month] = monthStr.split('-').map(Number);
    const totalDays = getDaysInMonth(year, month);

    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-${String(totalDays).padStart(2, '0')}`;

    // P2-2: 一次查询获取整月数据
    const records = await this.dailySummaryRepo.findByDateRange(openId, startDate, endDate);

    // 构建 date → record 映射表
    const dateMap = {};
    for (const r of records) {
      dateMap[r.date] = r;
    }

    let totalFocusMinutes = 0;
    let totalPomodoros = 0;
    let activeDays = 0;
    let completedTasks = 0;
    const dailyBreakdown = [];

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const record = dateMap[dateStr];

      // dailyBreakdown: 每天一条，无记录的日期填 0
      dailyBreakdown.push({
        date: dateStr,
        focusMinutes: record ? (record.focusMinutes || 0) : 0,
        pomodoroCount: record ? (record.pomodoroCount || 0) : 0,
      });

      if (record) {
        totalFocusMinutes += record.focusMinutes || 0;
        totalPomodoros += record.pomodoroCount || 0;
        completedTasks += record.completedTasks || 0;
        activeDays++;
      }
    }

    // 统计当前未完成的任务数（排除已删除的已完成任务）
    let pendingTasks = 0;
    try {
      pendingTasks = await this.taskRepo.count({ _openid: openId, isDone: false });
    } catch (err) {
      console.warn('[StatsService.getMonthlyStats] 查询未完成任务数失败:', err.message);
    }

    // totalTasks = 本月完成数 + 当前未完成数
    // 这样无论是完成任务后删除、还是跨月任务，分母不会小于分子，不会出现 >100%
    const totalTasks = completedTasks + pendingTasks;

    return {
      totalFocusMinutes,
      totalPomodoros,
      avgDailyFocus: Math.round(totalFocusMinutes / totalDays),
      activeDays,
      totalDays,
      completedTasks,
      totalTasks,
      completionRate: Math.round((activeDays / totalDays) * 100) / 100,
      dailyBreakdown,
    };
  }

  /**
   * 获取今日专注小时分布
   *
   * 从 sessions 集合查询今日所有 focus 类 session，
   * 按 startedAt 的小时（0-23）分桶，返回每小时专注分钟数。
   *
   * @param {string} openId
   * @returns {Promise<{hourlyBreakdown: Array<{hour: number, focusMinutes: number}>}>}
   */
  async getTodayDetail(openId) {
    const sessions = await this.sessionRepo.getTodaySessions(openId);

    // 初始化 24 个 bucket，全部填 0
    const buckets = new Array(24).fill(0);

    for (const s of sessions) {
      // 只统计 focus 类 session
      if (s.mode !== 'focus') continue;

      const startDate = new Date(s.startedAt);
      // 腾讯云函数时区为 UTC，需转换为东八区（Asia/Shanghai）
      const hour = (startDate.getUTCHours() + 8) % 24;
      const minutes = Math.round((s.duration || 0) / 60);
      buckets[hour] += minutes;
    }

    const hourlyBreakdown = buckets.map((minutes, hour) => ({
      hour,
      focusMinutes: minutes,
    }));

    return { hourlyBreakdown };
  }

  /**
   * 获取热力图数据（某月每日专注分钟数）
   *
   * P2-2: 一次范围查询替代 N 次逐日查询。
   * 只返回有数据的日期，无数据的日期由前端组件自行处理。
   *
   * @param {string} openId
   * @param {number} year  - 年份，如 2026
   * @param {number} month - 月份，1-12
   * @returns {Promise<Array<{date: string, focusMinutes: number}>>}
   */
  async getHeatmapData(openId, year, month) {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const totalDays = getDaysInMonth(year, month);
    const startDate = `${monthPrefix}-01`;
    const endDate = `${monthPrefix}-${String(totalDays).padStart(2, '0')}`;

    // P2-2: 一次查询获取整月数据
    const records = await this.dailySummaryRepo.findByDateRange(openId, startDate, endDate);

    return records.map(r => ({
      date: r.date,
      focusMinutes: r.focusMinutes || 0,
    }));
  }

}

module.exports = StatsService;
