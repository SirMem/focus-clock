/**
 * ai/context/weekly-context.js — 周报数据收集器
 *
 * 从 5 个数据源并行收集本周（周一~周日）数据，
 * 构建 AI 周报 prompt 所需的完整上下文。
 *
 * 使用 Promise.allSettled 确保单个数据源失败不阻塞整体。
 * 调用方通过 _missing 字段判断哪些数据源缺失。
 */

const { getDateStr, getWeekStart } = require('../../utils/helpers');

/**
 * @typedef {object} WeeklyContext
 * @property {string} userName
 * @property {number} dailyGoal
 * @property {{start: string, end: string}} weekRange
 * @property {Array<{date: string, focusMinutes: number, pomodoroCount: number}>} dailyBreakdown
 * @property {number} totalFocusMinutes
 * @property {number} totalPomodoros
 * @property {number} activeDays
 * @property {number} avgDailyFocus
 * @property {Array<{date: string, content: string, emotionTags: string[]}>} diaries
 * @property {{done: number, total: number, rate: string}} taskCompletion
 * @property {Array<{date: string, mode: string, duration: number, hour: number}>} sessions
 * @property {string[]} _missing
 */

/**
 * 收集周报所需的全量上下文数据
 *
 * @param {string} openId
 * @param {object} deps - 注入的 repo 实例
 * @param {object} deps.dailySummaryRepo
 * @param {object} deps.sessionRepo
 * @param {object} deps.diaryRepo
 * @param {object} deps.taskRepo
 * @param {object} deps.userRepo
 * @returns {Promise<WeeklyContext>}
 */
async function collectWeeklyContext(openId, deps) {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = getDateStr(weekEnd);

  // ── 计算 7 天日期列表 ──
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(getDateStr(d));
  }

  // ── 并行收集 5 类数据 ──
  const [dailyRes, sessionsRes, diariesRes, taskRes, userRes] =
    await Promise.allSettled([
      _collectDailySummaries(openId, dates, deps.dailySummaryRepo),
      _collectSessions(openId, dates[0], weekEndStr, deps.sessionRepo),
      _collectDiaries(openId, dates[0], weekEndStr, deps.diaryRepo),
      _collectTaskStats(openId, deps.taskRepo),
      _collectUser(openId, deps.userRepo),
    ]);

  const _missing = [];

  const dailyBreakdown = _unwrap(dailyRes, [], 'daily_summaries', _missing);
  const sessionsRaw = _unwrap(sessionsRes, [], 'sessions', _missing);
  const diaries = _unwrap(diariesRes, [], 'diaries', _missing);
  const taskCompletion = _unwrap(taskRes, { done: 0, total: 0, rate: '0%' }, 'tasks', _missing);
  const user = _unwrap(userRes, null, 'user', _missing);

  // ── 计算聚合值 ──
  let totalFocusMinutes = 0;
  let totalPomodoros = 0;
  let activeDays = 0;
  for (const d of dailyBreakdown) {
    totalFocusMinutes += d.focusMinutes;
    totalPomodoros += d.pomodoroCount;
    if (d.focusMinutes > 0) activeDays++;
  }

  // ── 处理 sessions：提取 hour ──
  const sessions = sessionsRaw.map(s => ({
    date: _tsToDateStr(s.completedAt),
    mode: s.mode || 'focus',
    duration: s.duration || 0,
    hour: _tsToHour(s.completedAt),
  }));

  // ── 处理 diaries：截断内容 ──
  const processedDiaries = diaries.map(d => ({
    date: _tsToDateStr(d.createdAt),
    content: (d.content || '').slice(0, 200),
    emotionTags: d.emotionTags || [],
  }));

  return {
    userName: user ? (user.nickName || '微信用户') : '用户',
    dailyGoal: user && user.settings ? (user.settings.dailyGoal || 4) : 4,
    weekRange: { start: dates[0], end: dates[6] },
    dailyBreakdown,
    totalFocusMinutes,
    totalPomodoros,
    activeDays,
    avgDailyFocus: Math.round(totalFocusMinutes / 7),
    diaries: processedDiaries,
    taskCompletion,
    sessions,
    _missing,
  };
}

// ── 内部收集器 ──────────────────────────────────────────────

async function _collectDailySummaries(openId, dates, repo) {
  const results = [];
  for (const dateStr of dates) {
    const record = await repo.findByDate(openId, dateStr);
    results.push({
      date: dateStr,
      focusMinutes: record ? (record.focusMinutes || 0) : 0,
      pomodoroCount: record ? (record.pomodoroCount || 0) : 0,
    });
  }
  return results;
}

async function _collectSessions(openId, startDate, endDate, repo) {
  // 分页拉取，上限 200 条（一周足够）
  const all = await repo.findByDateRange(openId, startDate, endDate, { page: 1, pageSize: 200 });
  return all;
}

async function _collectDiaries(openId, startDate, endDate, repo) {
  const startTs = new Date(startDate).getTime();
  const endTs = new Date(endDate + 'T23:59:59.999').getTime();
  const all = await repo.findAll(
    { _openid: openId, createdAt: repo.db.command.gte(startTs).and(repo.db.command.lte(endTs)) },
    { page: 1, pageSize: 50 },
  );
  return all;
}

async function _collectTaskStats(openId, repo) {
  const [doneCount, totalCount] = await Promise.all([
    repo.count({ _openid: openId, isDone: true }),
    repo.count({ _openid: openId }),
  ]);
  const rate = totalCount > 0 ? `${Math.round((doneCount / totalCount) * 100)}%` : '0%';
  return { done: doneCount, total: totalCount, rate };
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

function _tsToDateStr(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _tsToHour(ts) {
  if (!ts) return -1;
  return new Date(ts).getHours();
}

module.exports = { collectWeeklyContext };
