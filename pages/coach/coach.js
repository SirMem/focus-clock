const WEEKLY_TREND = [
  { day: '周一', hours: 2.5 },
  { day: '周二', hours: 3.2 },
  { day: '周三', hours: 4.5 },
  { day: '周四', hours: 3.8 },
  { day: '周五', hours: 2.9 },
  { day: '周六', hours: 1.5 },
  { day: '周日', hours: 1.2 },
];

const MAX_HOURS = Math.max(...WEEKLY_TREND.map(d => d.hours));

const ACHIEVEMENTS = [
  { icon: '🔥', label: '连续专注', value: '7 天', color: '#FF6B35', bgColor: '#FFF0EB' },
  { icon: '⭐', label: '完成', value: '50 个番茄', color: '#FFB800', bgColor: '#FFF8E1' },
  { icon: '📅', label: '本月专注', value: '22h', color: '#4A90D9', bgColor: '#EBF4FF' },
];

const COACHING_HISTORY = [
  { date: '昨天', text: '尝试使用番茄钟长专注模式，可能更适合你的工作节奏', accepted: true },
  { date: '6月26日', text: '下午2点后效率下降，建议安排简单任务或休息', accepted: false },
];

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    weeklyTrend: WEEKLY_TREND.map(d => ({
      ...d,
      height: (d.hours / MAX_HOURS) * 100,
    })),
    weeklyStats: [
      { label: '总时长', value: '19.6h' },
      { label: '完成任务', value: '24 个' },
      { label: '专注率', value: '87%' },
    ],
    achievements: ACHIEVEMENTS,
    coachingHistory: COACHING_HISTORY,
    suggestionAccepted: false,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });
  },

  onAcceptSuggestion() {
    if (this.data.suggestionAccepted) return;
    this.setData({ suggestionAccepted: true });
    wx.showToast({ title: '已采纳建议 ✓', icon: 'success' });
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
