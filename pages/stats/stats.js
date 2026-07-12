const statsAPI = require('../../miniprogram/api/stats.api');
const { formatDuration } = require('../../miniprogram/api/mappers');

// ===== 工具函数 =====

/**
 * 从 API 标准响应 { code, data, message } 中提取 data。
 * 非 0 code 返回 fallback，不 throw，确保单接口失败不会丢弃其他已成功的并行结果。
 */
function extractData(res, fallback) {
  if (!res) return fallback;
  if (res.code !== undefined) {
    if (res.code !== 0) return fallback;
    return 'data' in res ? res.data : fallback;
  }
  return res;
}

// ===== 页面 =====

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    period: 'week',
    periods: [
      { key: 'day', label: '日' },
      { key: 'week', label: '周' },
      { key: 'month', label: '月' },
    ],

    // 统计卡片（由 _updateSummaryCards 填充）
    summaryCards: [
      { icon: '⏱', value: '0m', label: '专注时长', isUp: true, trend: '—' },
      { icon: '🍅', value: '0 个', label: '完成番茄', isUp: true, trend: '—' },
      { icon: '✅', value: '0%', label: '本月出勤率', isUp: false, trend: '—' },
    ],

    heatmapData: [],

    score: 0,
    scoreInsight: '暂无数据',
    scoreEmoji: '📊',

    // 真实数据（传递给 stats-chart 组件）
    loading: false,
    todayStats: null,
    weeklyStats: null,
    monthlyStats: null,
    todayDetail: null,
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      capsuleHeight: 44,
    });
    this._loadStats();
  },

  onShow() {
    this._loadStats();
  },

  async _loadStats() {
    this.setData({ loading: true });
    try {
      const now = new Date();
      const [todayRes, weeklyRes, monthlyRes, heatmapRes, todayDetailRes] = await Promise.all([
        statsAPI.today(),
        statsAPI.weekly(),
        statsAPI.monthly(),
        statsAPI.heatmap(now.getFullYear(), now.getMonth() + 1),
        statsAPI.todayDetail(),
      ]);

      const today = extractData(todayRes, {});
      const weekly = extractData(weeklyRes, {});
      const monthly = extractData(monthlyRes, {});
      const heatmap = extractData(heatmapRes, []);
      const todayDetail = extractData(todayDetailRes, null);
      const didFail = todayRes.code !== 0 || weeklyRes.code !== 0 ||
                      monthlyRes.code !== 0 || heatmapRes.code !== 0;

      // todayDetail: 新用户无 session 不是错误，用默认 24 个 0 兜底
      const safeDetail = todayDetail || { hourlyBreakdown: [] };
      if (!Array.isArray(safeDetail.hourlyBreakdown) || safeDetail.hourlyBreakdown.length !== 24) {
        safeDetail.hourlyBreakdown = new Array(24).fill(0).map((_, i) => ({ hour: i, focusMinutes: 0 }));
      }

      this.setData({
        todayStats: today || {},
        weeklyStats: weekly || {},
        monthlyStats: monthly || {},
        heatmapData: Array.isArray(heatmap) ? heatmap : [],
        todayDetail: safeDetail,
      });

      if (didFail) {
        wx.showToast({ title: '部分统计数据加载失败', icon: 'none' });
      }

      // 更新主包视图（摘要卡片 + 评分卡片）
      this._updateSummaryCards();
      this._updateScoreCard();
      // 图表由 stats-chart 组件通过数据绑定自动更新
    } catch (err) {
      console.error('[stats] 加载统计失败', err);
      wx.showToast({ title: '加载统计数据失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /** 更新摘要卡片 */
  _updateSummaryCards() {
    const todayStats = this.data.todayStats || {};
    const monthlyStats = this.data.monthlyStats || {};

    const focusMinutes = todayStats.focusMinutes || 0;
    const pomodoroCount = todayStats.pomodoroCount || 0;
    const completionRate = monthlyStats ? (monthlyStats.completionRate || 0) : 0;

    const summaryCards = [
      { icon: '⏱', value: formatDuration(focusMinutes), label: '专注时长', isUp: true, trend: '—' },
      { icon: '🍅', value: `${pomodoroCount} 个`, label: '完成番茄', isUp: true, trend: '—' },
      { icon: '✅', value: `${Math.round(completionRate * 100)}%`, label: '本月出勤率', isUp: false, trend: '—' },
    ];

    this.setData({ summaryCards });
  },

  /** 更新评分卡片 */
  _updateScoreCard() {
    const todayStats = this.data.todayStats || {};
    const hasScore = todayStats.aiScore != null;
    const score = hasScore ? todayStats.aiScore : 0;
    const insight = hasScore ? '今日专注表现已生成' : '完成一次专注后生成分析';

    let emoji = '📊';
    if (score >= 90) emoji = '🎯';
    else if (score >= 70) emoji = '👍';
    else if (score >= 50) emoji = '💪';

    this.setData({
      score,
      scoreInsight: insight,
      scoreEmoji: emoji,
    });
  },

  onPeriodChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ period: key });
    // 组件通过 period 属性监听自动更新趋势图
  },

  onJournalTap() {
    wx.switchTab({ url: '/pages/diary/diary' });
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
