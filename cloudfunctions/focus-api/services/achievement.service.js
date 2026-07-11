/**
 * achievement.service.js —— 成就规则引擎
 *
 * 从 daily_summaries 和 sessions 聚合数据，逐条判定 12 条成就规则。
 * 所有判定基于当前真实数据动态计算，无需持久化成就状态。
 *
 * 规则列表：
 *   1  坚持达人   连续专注 7 天               streak >= 7
 *   2  番茄收割机  累计完成 50 个番茄           totalPomodoros >= 50
 *   3  心流状态    单日完成 10 个番茄            maxDaily >= 10
 *   4  学习狂人    总专注 >= 20h               totalMinutes >= 1200
 *   5  晨型人      连续 5 天 8 点前开始          earlyDays >= 5
 *   6  月度冠军    单月专注超过 40h              maxMonthly >= 2400
 *   7  钻石专注    累计专注 200h                totalMinutes >= 12000
 *   8  百日打卡    连续专注 100 天               streak >= 100
 *   9  目标猎人    连续 3 月达成目标              goalMonths >= 3
 *  10  夜枭专注    21 点后完成 5 个番茄           nightPomodoros >= 5
 *  11  闪电模式    单次专注不中断 2h              maxSession >= 120
 *  12  全球同步    社交功能暂不可达               始终 false
 */

const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const { getDb } = require('../utils/cloud');

// ── 规则定义 ──

const RULES = [
  {
    id: 1, icon: '🔥', name: '坚持达人', desc: '连续专注 7 天',
    check: (ctx) => ctx.streak >= 7, target: 7, getCurrent: (ctx) => ctx.streak,
  },
  {
    id: 2, icon: '⭐', name: '番茄收割机', desc: '累计完成 50 个番茄',
    check: (ctx) => ctx.totalPomodoros >= 50, target: 50, getCurrent: (ctx) => ctx.totalPomodoros,
  },
  {
    id: 3, icon: '🧘', name: '心流状态', desc: '单日完成 10 个番茄',
    check: (ctx) => ctx.maxDaily >= 10, target: 10, getCurrent: (ctx) => ctx.maxDaily,
  },
  {
    id: 4, icon: '📚', name: '学习狂人', desc: '累计专注 20 小时',
    check: (ctx) => ctx.totalMinutes >= 1200, target: 1200, getCurrent: (ctx) => ctx.totalMinutes,
  },
  {
    id: 5, icon: '🌅', name: '晨型人', desc: '累计 5 天 8 点前开始专注',
    check: (ctx) => ctx.earlyDays >= 5, target: 5, getCurrent: (ctx) => ctx.earlyDays,
  },
  {
    id: 6, icon: '🏅', name: '月度冠军', desc: '单月专注超过 40 小时',
    check: (ctx) => ctx.maxMonthly >= 2400, target: 2400, getCurrent: (ctx) => ctx.maxMonthly,
  },
  {
    id: 7, icon: '💎', name: '钻石专注', desc: '累计专注 200 小时',
    check: (ctx) => ctx.totalMinutes >= 12000, target: 12000, getCurrent: (ctx) => ctx.totalMinutes,
  },
  {
    id: 8, icon: '🚀', name: '百日打卡', desc: '连续专注 100 天',
    check: (ctx) => ctx.streak >= 100, target: 100, getCurrent: (ctx) => ctx.streak,
  },
  {
    id: 9, icon: '🎯', name: '目标猎人', desc: '连续 3 月达成目标',
    check: (ctx) => ctx.goalMonths >= 3, target: 3, getCurrent: (ctx) => ctx.goalMonths,
  },
  {
    id: 10, icon: '🌙', name: '夜枭专注', desc: '21 点后完成 5 个番茄',
    check: (ctx) => ctx.nightPomodoros >= 5, target: 5, getCurrent: (ctx) => ctx.nightPomodoros,
  },
  {
    id: 11, icon: '⚡', name: '闪电模式', desc: '单次专注不中断 2 小时',
    check: (ctx) => ctx.maxSession >= 120, target: 120, getCurrent: (ctx) => ctx.maxSession,
  },
  {
    id: 12, icon: '🌍', name: '全球同步', desc: '与全球用户一同专注',
    check: () => false, target: 1, getCurrent: () => 0,
  },
];

class AchievementService {

  constructor(dailySummaryRepo, sessionRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
  }

  /**
   * 工厂方法
   * @returns {AchievementService}
   */
  static create() {
    return new AchievementService(DailySummaryRepo.create(), SessionRepo.create());
  }

  /**
   * 获取用户全部成就判定结果
   * @param {string} openId
   * @returns {Promise<{achievements: Array, summary: {earned: number, total: number}}>}
   */
  async getAchievements(openId) {
    // 1. 聚合原始数据
    const ctx = await this._aggregate(openId);

    // 2. 逐条判定
    const achievements = RULES.map((rule) => {
      const current = rule.getCurrent(ctx);
      const progress = Math.min(100, Math.round((current / rule.target) * 100));
      const earned = rule.check(ctx);
      return {
        id: rule.id,
        icon: rule.icon,
        name: rule.name,
        desc: rule.desc,
        earned,
        progress: earned ? 100 : progress,
        current,
        target: rule.target,
      };
    });

    const earned = achievements.filter((a) => a.earned).length;

    return {
      achievements,
      summary: { earned, total: achievements.length },
    };
  }

  /**
   * 从 daily_summaries 和 sessions 聚合用户数据
   * @param {string} openId
   * @returns {Promise<object>} 聚合上下文
   */
  async _aggregate(openId) {
    const db = this.dailySummaryRepo.collection;
    const sessionCol = this.sessionRepo.collection;
    const _ = db.command;

    // ── 1. 查所有 daily_summaries → 总番茄数、总分钟数、活跃天数 ──
    const allSummaries = await db
      .where({ _openid: openId })
      .orderBy('date', 'asc')
      .get()
      .then((r) => r.data);

    let totalPomodoros = 0;
    let totalMinutes = 0;
    let activeDays = 0;
    let maxDaily = 0;

    for (const s of allSummaries) {
      const p = s.pomodoroCount || 0;
      const m = s.focusMinutes || 0;
      totalPomodoros += p;
      totalMinutes += m;
      if (m > 0) activeDays++;
      if (p > maxDaily) maxDaily = p;
    }

    // ── 2. 算最长连续打卡 streak ──
    let streak = 0;
    let tempStreak = 0;
    for (const s of allSummaries) {
      if ((s.focusMinutes || 0) > 0) {
        tempStreak++;
        if (tempStreak > streak) streak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // ── 3. 查 sessions → 早鸟天数、夜猫番茄数、最大单次时长 ──
    let earlyDays = 0;
    let nightPomodoros = 0;
    let maxSession = 0;

    // 查 focus 模式的完成会话
    const allFocusSessions = await sessionCol
      .where({ _openid: openId, mode: 'focus' })
      .get()
      .then((r) => r.data);

    // 按日期分组去重统计早鸟天数（同一天多次 8 点前只算 1 天）
    const earlyDateSet = new Set();
    for (const s of allFocusSessions) {
      const startedAt = s.startedAt || s.completedAt;
      if (startedAt) {
        const d = new Date(startedAt);
        const hour = d.getHours();
        const dateStr = d.toISOString().slice(0, 10);
        if (hour < 8) {
          earlyDateSet.add(dateStr);
        }
        if (hour >= 21) {
          nightPomodoros++;
        }
      }
      if ((s.duration || 0) > maxSession) {
        maxSession = s.duration;
      }
    }
    earlyDays = earlyDateSet.size;

    // maxSession 是秒数，转分钟
    maxSession = Math.round(maxSession / 60);

    // ── 4. 按月聚合 → 单月最大专注分钟数 ──
    const monthlyMap = {};
    for (const s of allSummaries) {
      const monthKey = s.date ? s.date.slice(0, 7) : '';
      if (!monthKey) continue;
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
      monthlyMap[monthKey] += s.focusMinutes || 0;
    }

    const monthlyEntries = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
    let maxMonthly = 0;
    for (const [, mins] of monthlyEntries) {
      if (mins > maxMonthly) maxMonthly = mins;
    }

    // ── 5. 连续达成目标月数 goalMonths ──
    // 目标：假设用户设置月目标为 40h (2400min)，统计连续达标月数
    const GOAL_THRESHOLD = 2400; // 40h
    let goalMonths = 0;
    let tempGoalStreak = 0;
    for (const [, mins] of monthlyEntries) {
      if (mins >= GOAL_THRESHOLD) {
        tempGoalStreak++;
        if (tempGoalStreak > goalMonths) goalMonths = tempGoalStreak;
      } else {
        tempGoalStreak = 0;
      }
    }

    return {
      totalPomodoros,
      totalMinutes,
      activeDays,
      maxDaily,
      streak,
      earlyDays,
      nightPomodoros,
      maxSession,
      maxMonthly,
      goalMonths,
    };
  }
}

module.exports = AchievementService;
