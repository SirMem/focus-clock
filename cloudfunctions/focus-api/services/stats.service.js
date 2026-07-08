/**
 * stats.service.js —— 统计模块业务逻辑
 *
 * 提供今日/周/月统计 + 热力图数据的聚合计算。
 * 通过构造函数注入依赖（DailySummaryRepo, SessionRepo），方便测试。
 *
 * P2-2: 周统计、月统计、热力图均改为一次范围查询，消除 N+1 逐日查询。
 *
 * 契约: docs/dev-specs/03-stats.md
 */

const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const { getDateStr, getWeekStart, getMonthStr, getDaysInMonth } = require('../utils/helpers');

class StatsService {

  constructor(dailySummaryRepo, sessionRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
  }

  /**
   * 工厂方法
   * @returns {StatsService}
   */
  static create() {
    return new StatsService(DailySummaryRepo.create(), SessionRepo.create());
  }

  /**
   * 获取今日统计数据
   *
   * 从 daily_summaries 集合中查询当日预聚合数据。
   * 无记录时返回全部 0，不抛异常。
   *
   * @param {string} openId
   * @returns {Promise<{focusMinutes: number, pomodoroCount: number, completedTasks: number, aiScore?: number}>}
   */
  async getTodayStats(openId) {
    const record = await this.dailySummaryRepo.findByDate(openId, getDateStr());

    if (!record) {
      return { focusMinutes: 0, pomodoroCount: 0, completedTasks: 0 };
    }

    return {
      focusMinutes: record.focusMinutes || 0,
      pomodoroCount: record.pomodoroCount || 0,
      completedTasks: record.completedTasks || 0,
      aiScore: record.aiScore,
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

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      const record = dateMap[dateStr];

      if (record) {
        totalFocusMinutes += record.focusMinutes || 0;
        totalPomodoros += record.pomodoroCount || 0;
        activeDays++;
      }
    }

    return {
      totalFocusMinutes,
      totalPomodoros,
      avgDailyFocus: Math.round(totalFocusMinutes / totalDays),
      activeDays,
      totalDays,
      completionRate: Math.round((activeDays / totalDays) * 100) / 100,
    };
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
