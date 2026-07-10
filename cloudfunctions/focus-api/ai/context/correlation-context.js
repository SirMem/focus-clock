/**
 * ai/context/correlation-context.js — 关联分析数据收集器
 *
 * 收集近 30 天跨维度数据，用于情绪-专注关联分析。
 * 按情绪标签分组计算平均专注时长，并与全时段均值对比。
 *
 * P1 实现，当前文件已就绪但 coach/correlation 路由暂未实现前端调用。
 */

const { getDateStr } = require('../../utils/helpers');

/**
 * @typedef {object} CorrelationContext
 * @property {Array<{date: string, focusMinutes: number, pomodoroCount: number, emotionTags: string[], hasDiary: boolean, completedTasks: number}>} days
 * @property {{totalDays: number, activeDays: number, avgFocusMinutes: number, avgPomodoros: number}} overall
 * @property {Array<{emotion: string, days: number, avgFocusMinutes: number, avgPomodoros: number}>} emotionBreakdown
 * @property {string[]} _missing
 */

/**
 * 收集 30 天关联分析上下文
 *
 * @param {string} openId
 * @param {object} deps
 * @param {object} deps.dailySummaryRepo
 * @param {object} deps.diaryRepo
 * @param {object} deps.taskRepo
 * @param {object} deps.userRepo
 * @returns {Promise<CorrelationContext>}
 */
async function collectCorrelationContext(openId, deps) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);

  // ── 生成 30 天日期列表 ──
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(getDateStr(d));
  }

  // ── 并行收集 ──
  const [dailyRes, diariesRes, userRes] = await Promise.allSettled([
    _collectDailySummaries(openId, dates, deps.dailySummaryRepo),
    _collectDiaries30d(openId, startDate, deps.diaryRepo),
    _collectUser(openId, deps.userRepo),
  ]);

  const _missing = [];

  const dailyMap = _unwrap(dailyRes, {}, 'daily_summaries', _missing);
  const diariesByDate = _unwrap(diariesRes, {}, 'diaries', _missing);
  const user = _unwrap(userRes, null, 'user', _missing);

  // ── 构建每天的完整画像 ──
  const days = dates.map(date => ({
    date,
    focusMinutes: dailyMap[date] ? dailyMap[date].focusMinutes : 0,
    pomodoroCount: dailyMap[date] ? dailyMap[date].pomodoroCount : 0,
    emotionTags: diariesByDate[date] || [],
    hasDiary: !!diariesByDate[date],
    completedTasks: dailyMap[date] ? (dailyMap[date].completedTasks || 0) : 0,
  }));

  // ── 全局统计 ──
  const activeDays = days.filter(d => d.focusMinutes > 0).length;
  const totalFocus = days.reduce((s, d) => s + d.focusMinutes, 0);
  const totalPomodoros = days.reduce((s, d) => s + d.pomodoroCount, 0);

  // ── 按情绪分组 ──
  const emotionMap = {};
  for (const day of days) {
    if (!day.hasDiary || day.emotionTags.length === 0) continue;
    for (const emotion of day.emotionTags) {
      if (!emotionMap[emotion]) {
        emotionMap[emotion] = { days: 0, focusMinutes: 0, pomodoros: 0 };
      }
      emotionMap[emotion].days++;
      emotionMap[emotion].focusMinutes += day.focusMinutes;
      emotionMap[emotion].pomodoros += day.pomodoroCount;
    }
  }

  const emotionBreakdown = Object.entries(emotionMap).map(([emotion, stats]) => ({
    emotion,
    days: stats.days,
    avgFocusMinutes: Math.round(stats.focusMinutes / stats.days),
    avgPomodoros: Math.round((stats.pomodoros / stats.days) * 10) / 10,
  }));

  return {
    days,
    overall: {
      totalDays: 30,
      activeDays,
      avgFocusMinutes: Math.round(totalFocus / 30),
      avgPomodoros: Math.round((totalPomodoros / 30) * 10) / 10,
    },
    emotionBreakdown,
    _missing,
  };
}

// ── 内部收集器 ──────────────────────────────────────────────

async function _collectDailySummaries(openId, dates, repo) {
  const map = {};
  for (const dateStr of dates) {
    const record = await repo.findByDate(openId, dateStr);
    if (record) {
      map[dateStr] = {
        focusMinutes: record.focusMinutes || 0,
        pomodoroCount: record.pomodoroCount || 0,
        completedTasks: record.completedTasks || 0,
      };
    }
  }
  return map;
}

async function _collectDiaries30d(openId, startDate, repo) {
  const startTs = startDate.getTime();
  const all = await repo.findAll(
    { _openid: openId, createdAt: repo.db.command.gte(startTs) },
    { page: 1, pageSize: 100 },
  );
  const byDate = {};
  for (const d of all) {
    const dateStr = getDateStr(new Date(d.createdAt));
    byDate[dateStr] = d.emotionTags || [];
  }
  return byDate;
}

async function _collectUser(openId, repo) {
  return repo.findByOpenId(openId);
}

// ── 工具函数 ────────────────────────────────────────────────

function _unwrap(result, fallback, sourceName, missingList) {
  if (result.status === 'fulfilled') return result.value;
  missingList.push(sourceName);
  return fallback;
}

module.exports = { collectCorrelationContext };
