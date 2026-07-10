const coachAPI = require('../../miniprogram/api/coach.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const { formatDuration } = require('../../miniprogram/api/mappers');

// 星期标签
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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

/**
 * 将 weeklyStats.dailyBreakdown 转为柱状图所需格式
 */
function buildWeeklyTrend(dailyBreakdown) {
  if (!Array.isArray(dailyBreakdown)) return [];
  const maxMinutes = Math.max(...dailyBreakdown.map(d => d.focusMinutes || 0), 1);
  return dailyBreakdown.map((d, i) => ({
    day: DAY_LABELS[i] || (d.date || '').slice(-5),
    hours: ((d.focusMinutes || 0) / 60).toFixed(1),
    height: ((d.focusMinutes || 0) / maxMinutes) * 100,
  }));
}

/**
 * 将 weeklyStats 转为摘要卡片格式
 */
function buildWeeklyStats(weekly) {
  if (!weekly) return [];
  return [
    { label: '总时长', value: formatDuration(weekly.totalFocusMinutes || 0) },
    { label: '完成番茄', value: `${weekly.totalPomodoros || 0} 个` },
    { label: '活跃天数', value: `${weekly.activeDays || 0}/7 天` },
  ];
}

/**
 * 将 insights 转为成就展示格式（P0: achievement 类型优先）
 */
function buildAchievements(insights) {
  if (!Array.isArray(insights)) return [];
  return insights
    .filter(item => item.type === 'achievement')
    .slice(0, 3)
    .map(item => ({
      icon: item.icon || '⭐',
      label: item.text.slice(0, 8),
      value: item.value || '达成',
      color: '#4A90D9',
      bgColor: '#EBF4FF',
    }));
}

/**
 * 将 AI 报告的 highlights 转为成就展示（优先级高于规则引擎 insights）
 */
function buildAIHighlights(highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) return [];
  return highlights.slice(0, 3).map(h => ({
    icon: h.emoji || '💡',
    label: h.text.slice(0, 8),
    value: '',
    color: '#FF6B35',
    bgColor: '#FFF0EB',
  }));
}

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    loading: true,
    // hero card
    score: 0,
    level: '新手',
    // suggestion
    suggestionText: '',
    suggestionAccepted: false,
    // insights / weekly
    weeklyTrend: [],
    weeklyStats: [],
    achievements: [],
    coachingHistory: [],

    // 🆕 AI 周报
    aiReport: '',
    aiHighlights: [],
    aiSuggestion: '',
    aiEmotionInsight: '',
    reportGeneratedBy: '',       // 'ai' | 'rule'
    aiReportLoading: false,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });
    this._loadCoachData();
  },

  async _loadCoachData() {
    this.setData({ loading: true, aiReportLoading: true });
    try {
      const [scoreRes, tipRes, weeklyRes, reportRes] = await Promise.all([
        coachAPI.score(),
        coachAPI.tip(),
        statsAPI.weekly(),
        coachAPI.weeklyReport(),
      ]);

      const scoreData = extractData(scoreRes, null);
      const tipData = extractData(tipRes, null);
      const weeklyData = extractData(weeklyRes, null);
      const reportData = extractData(reportRes, null);

      const didFail = !scoreData || !tipData || !weeklyData;

      // ── AI 报告数据 ──
      const aiReport = reportData ? reportData.report || '' : '';
      const aiHighlights = reportData ? buildAIHighlights(reportData.highlights) : [];
      const aiSuggestion = reportData ? (reportData.suggestion || '') : '';
      const aiEmotionInsight = reportData ? (reportData.emotionInsight || '') : '';
      const reportGeneratedBy = reportData ? (reportData.generatedBy || 'rule') : 'rule';

      // ── 成就优先使用 AI highlights，fallback 到规则引擎 insights ──
      const achievements = aiHighlights.length > 0
        ? aiHighlights
        : buildAchievements(scoreData ? scoreData.insights : []);

      // ── 趋势洞察文案优先用 AI 报告开头，fallback 到规则引擎 tip ──
      const insightText = aiReport
        ? aiReport.slice(0, 120) + (aiReport.length > 120 ? '...' : '')
        : (tipData ? tipData.tip : '');

      this.setData({
        score: scoreData ? scoreData.score : 0,
        level: scoreData ? scoreData.level : '新手',
        suggestionText: aiSuggestion || (tipData ? tipData.tip : ''),
        weeklyTrend: weeklyData ? buildWeeklyTrend(weeklyData.dailyBreakdown) : [],
        weeklyStats: weeklyData ? buildWeeklyStats(weeklyData) : [],
        achievements,
        coachingHistory: [],
        aiReport,
        aiHighlights,
        aiSuggestion,
        aiEmotionInsight,
        reportGeneratedBy,
        insightText,
        loading: false,
        aiReportLoading: false,
      });

      if (didFail) {
        wx.showToast({ title: '部分教练数据加载失败', icon: 'none' });
      }
    } catch (err) {
      console.error('[coach] 加载教练数据失败', err);
      wx.showToast({ title: '加载教练数据失败', icon: 'none' });
      this.setData({ loading: false, aiReportLoading: false });
    }
  },

  onAcceptSuggestion() {
    if (this.data.suggestionAccepted) return;
    this.setData({ suggestionAccepted: true });
    wx.showToast({ title: '已采纳建议', icon: 'success' });
  },

  onViewAllAchievements() {
    wx.showToast({ title: '全部成就', icon: 'none' });
  },

  onViewWeeklyReport() {
    wx.showToast({ title: '查看完整周报', icon: 'none' });
  },

  onCoachSettings() {
    wx.showToast({ title: 'AI 教练设置', icon: 'none' });
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
