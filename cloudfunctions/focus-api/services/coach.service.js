/**
 * coach.service.js —— AI 教练评分引擎
 *
 * 基于纯规则引擎计算综合评分、等级和建议，不依赖外部 LLM。
 * 从 daily_summaries 集合拉取近 7 天数据，按三个维度加权评分。
 *
 * 契约: docs/api-contracts.md §7 · docs/archive/issues/06-coach-module.md
 */

const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const UserRepo = require('../repositories/user.repo');
const { getDateStr, getWeekStart } = require('../utils/helpers');

// ── 评分维度纯函数 ────────────────────────────────────────────

/**
 * 持续性 (Consistency) — 权重 40%
 * 近 7 天活跃天数越多越高
 */
function calcConsistency(weekData) {
  const activeDays = weekData.filter(d => d.focusMinutes > 0).length;
  if (activeDays >= 5) return 100;
  if (activeDays >= 3) return 70;
  if (activeDays >= 1) return 40;
  return 0;
}

/**
 * 专注量 (Volume) — 权重 35%
 * 近 7 天总番茄数越多越高
 */
function calcVolume(weekData) {
  const total = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
  if (total >= 20) return 100;
  if (total >= 10) return 70;
  if (total >= 5) return 40;
  if (total >= 1) return 20;
  return 0;
}

/**
 * 均衡度 (Balance) — 权重 25%
 * 每天 >= 2 个番茄的天数 vs 总活跃天数
 */
function calcBalance(weekData) {
  const highDays = weekData.filter(d => d.pomodoroCount >= 2).length;
  const totalActive = weekData.filter(d => d.focusMinutes > 0).length;
  if (totalActive === 0) return 30;
  const ratio = highDays / totalActive;
  if (ratio >= 0.6) return 100;
  if (ratio >= 0.3) return 60;
  return 30;
}

/**
 * 分数 → 等级映射
 */
function scoreToLevel(score) {
  if (score >= 81) return '大师';
  if (score >= 61) return '达人';
  if (score >= 41) return '进阶';
  if (score >= 21) return '入门';
  return '新手';
}

/**
 * 洞察生成 — 基于各维度得分生成 achievement 或 improvement
 */
function generateInsights(score, weekData) {
  const insights = [];
  const consistency = calcConsistency(weekData);
  const volume = calcVolume(weekData);
  const balance = calcBalance(weekData);
  const totalPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
  const activeDays = weekData.filter(d => d.focusMinutes > 0).length;

  // 持续性洞察
  if (consistency >= 100) {
    insights.push({
      type: 'achievement',
      icon: '🔥',
      text: '连续专注表现优秀，本周 5 天以上都完成了专注！',
    });
  } else if (consistency === 0) {
    insights.push({
      type: 'improvement',
      icon: '📅',
      text: '本周还没有开始专注，现在就是最好的开始时间！',
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '📅',
      text: `本周仅 ${activeDays} 天有专注记录，尝试每周至少 5 天打开专注，好习惯从现在开始。`,
    });
  }

  // 专注量洞察
  if (volume >= 100) {
    insights.push({
      type: 'achievement',
      icon: '🍅',
      text: `本周完成 ${totalPomodoros} 个番茄，产量拉满！`,
      value: `${totalPomodoros} 个`,
    });
  } else if (volume > 0) {
    insights.push({
      type: 'improvement',
      icon: '⏱',
      text: `本周完成 ${totalPomodoros} 个番茄，每天多完成一个，很快就能感受到复利的力量。`,
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '⏱',
      text: '设定每日番茄目标，从小目标开始建立专注节奏。',
    });
  }

  // 均衡度洞察
  if (balance >= 100) {
    insights.push({
      type: 'achievement',
      icon: '⚡',
      text: '专注分布非常均衡，每天都能保持稳定的产出节奏！',
    });
  } else if (balance >= 60) {
    insights.push({
      type: 'tip',
      icon: '💡',
      text: '专注节奏不错，试着每天至少完成 2 个番茄，让每一天都有成就感。',
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '📊',
      text: '每天完成至少 2 个番茄能让专注习惯更稳固，试试看！',
    });
  }

  return insights;
}

// ── CoachService ──────────────────────────────────────────────

class CoachService {

  constructor(dailySummaryRepo, sessionRepo, userRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
  }

  /**
   * 工厂方法
   * @returns {CoachService}
   */
  static create() {
    return new CoachService(
      DailySummaryRepo.create(),
      SessionRepo.create(),
      UserRepo.create(),
    );
  }

  /**
   * 获取综合评分
   *
   * @param {string} openId
   * @returns {Promise<{score: number, level: string, insights: Array, updatedAt: number}>}
   */
  async getScore(openId) {
    const weekData = await this._getLast7DaysData(openId);
    const consistency = calcConsistency(weekData);
    const volume = calcVolume(weekData);
    const balance = calcBalance(weekData);
    const score = Math.round(consistency * 0.4 + volume * 0.35 + balance * 0.25);
    const level = scoreToLevel(score);
    const insights = generateInsights(score, weekData);

    return { score, level, insights, updatedAt: Date.now() };
  }

  /**
   * 获取今日建议
   *
   * @param {string} openId
   * @returns {Promise<{tip: string, context: {todayPomodoros: number, weeklyAverage: number, dailyGoal: number}}>}
   */
  async getTip(openId) {
    const user = await this.userRepo.findByOpenId(openId);
    const dailyGoal = user?.settings?.dailyGoal || 4;
    const weekData = await this._getLast7DaysData(openId);
    const todayStr = getDateStr();
    const todayData = weekData.find(d => d.date === todayStr) || { pomodoroCount: 0 };
    const weeklyPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
    const weeklyAverage = Math.round(weeklyPomodoros / 7);

    let tip;
    if (todayData.pomodoroCount === 0) {
      tip = '今天还没有开始专注，打开计时器开始第一个番茄吧！';
    } else if (todayData.pomodoroCount >= dailyGoal) {
      tip = `太棒了！已完成今日目标 ${dailyGoal} 个番茄！`;
    } else if (todayData.pomodoroCount >= weeklyAverage) {
      tip = '今日表现良好，继续保持这个节奏！';
    } else {
      tip = '今日进度略慢于平均水平，利用碎片时间再冲刺一个番茄吧。';
    }

    return {
      tip,
      context: {
        todayPomodoros: todayData.pomodoroCount,
        weeklyAverage,
        dailyGoal,
      },
    };
  }

  /**
   * 获取最近 7 天的日汇总数据
   * @param {string} openId
   * @returns {Promise<Array<{date: string, focusMinutes: number, pomodoroCount: number}>>}
   * @private
   */
  async _getLast7DaysData(openId) {
    const weekStart = getWeekStart();
    const results = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = getDateStr(date);

      const record = await this.dailySummaryRepo.findByDate(openId, dateStr);
      results.push({
        date: dateStr,
        focusMinutes: record ? (record.focusMinutes || 0) : 0,
        pomodoroCount: record ? (record.pomodoroCount || 0) : 0,
      });
    }

    return results;
  }

}

module.exports = CoachService;
