Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    // 通知设置
    dailyTipPush: true,
    weeklyReportPush: true,

    // AI 偏好
    suggestionStyle: 'gentle',     // 'gentle' | 'direct' | 'balanced'
    deepAnalysis: false,

    // 关于
    aiPowered: true,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });
    this._loadSettings();
  },

  /**
   * 从本地 Storage 恢复设置
   */
  _loadSettings() {
    try {
      const saved = wx.getStorageSync('coach_settings');
      if (saved) {
        this.setData(saved);
      }
    } catch (err) {
      console.warn('[coach-settings] 读取设置失败', err);
    }
  },

  /**
   * 保存设置到本地 Storage
   */
  _saveSettings() {
    try {
      wx.setStorageSync('coach_settings', {
        dailyTipPush: this.data.dailyTipPush,
        weeklyReportPush: this.data.weeklyReportPush,
        suggestionStyle: this.data.suggestionStyle,
        deepAnalysis: this.data.deepAnalysis,
      });
    } catch (err) {
      console.warn('[coach-settings] 保存设置失败', err);
    }
  },

  onNavigateBack() {
    wx.navigateBack();
  },

  onToggleDailyTip(e) {
    this.setData({ dailyTipPush: e.detail.value });
    this._saveSettings();
    wx.showToast({ title: e.detail.value ? '已开启每日建议' : '已关闭每日建议', icon: 'none' });
  },

  onToggleWeeklyReport(e) {
    this.setData({ weeklyReportPush: e.detail.value });
    this._saveSettings();
    wx.showToast({ title: e.detail.value ? '已开启周报推送' : '已关闭周报推送', icon: 'none' });
  },

  onChangeStyle() {
    const cycle = { gentle: 'direct', direct: 'balanced', balanced: 'gentle' };
    const next = cycle[this.data.suggestionStyle] || 'gentle';
    const labels = { gentle: '温柔鼓励', direct: '直接实用', balanced: '平衡适中' };
    this.setData({ suggestionStyle: next });
    this._saveSettings();
    wx.showToast({ title: `已切换至"${labels[next]}"风格`, icon: 'none' });
  },

  onToggleDeepAnalysis(e) {
    this.setData({ deepAnalysis: e.detail.value });
    this._saveSettings();
    wx.showToast({ title: e.detail.value ? '已开启深度分析' : '已关闭深度分析', icon: 'none' });
  },
});
