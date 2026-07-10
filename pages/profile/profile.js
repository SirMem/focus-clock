const app = getApp();
const userAPI = require('../../miniprogram/api/user.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const { getLoginState, saveLoginState, clearLoginState } = require('../../miniprogram/api/auth');
const { formatDuration } = require('../../miniprogram/api/mappers');

/**
 * 从 API 标准响应 { code, data, message } 中提取 data。
 */
function extractData(res, fallback) {
  if (!res) return fallback;
  if (res.code !== undefined) {
    if (res.code !== 0) return fallback;
    return 'data' in res ? res.data : fallback;
  }
  return res;
}

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    // ── 单页内视图切换 ──
    currentView: 'main', // 'main' | 'goal' | 'achievements' | 'theme' | 'export' | 'help' | 'about'
    subViewTitle: '',

    isLoggedIn: false,
    userInfo: null,
    settings: null,

    // 可编辑的用户资料（chooseAvatar + type=nickname）
    avatarUrl: '',
    nickName: '',
    profileDirty: false,
    profileSubmitting: false,

    // 🐛 修复：统计摘要行（WXML 有渲染但从未填充）
    summaryStats: [
      { icon: '⏱️', value: '—', label: '累计专注' },
      { icon: '🔥', value: '—', label: '连续打卡' },
      { icon: '🏆', value: '—', label: '获得勋章' },
    ],

    // 🐛 修复：本月目标卡片（WXML 有渲染但从未填充）
    monthlyGoalProgress: 0,
    monthlyGoalCurrent: 0,
    monthlyGoalTarget: 50,
    goalRemain: 50,

    featureMenu: [
      { icon: '🎯', label: '个人目标', desc: '设置专注参数', key: 'goal' },
      { icon: '🤖', label: 'AI 教练', desc: '查看今日建议', key: 'coach', badge: '92分', badgeColor: '#34C759' },
      { icon: '🏆', label: '成就勋章', desc: '查看已获得的勋章', key: 'achievements' },
    ],

    settingMenu: [
      { icon: '🔔', label: '消息通知', desc: '番茄完成时推送提醒', key: 'notification', type: 'switch', enabled: true },
      { icon: '🔊', label: '音效', desc: '计时结束铃声提示', key: 'sound', type: 'switch', enabled: true },
      { icon: '📳', label: '振动', desc: '计时结束震动提示', key: 'vibration', type: 'switch', enabled: false },
    ],

    aboutMenu: [
      { icon: '💬', label: '帮助与反馈', desc: '遇到问题？告诉我们', key: 'help' },
      { icon: 'ℹ️', label: '关于 & 评分', desc: '版本 2.1.0', key: 'about' },
    ],
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });
  },

  onShow() {
    this._loadProfile();
  },

  // ═══════════════════════════════════════════════════════════
  //  单页内视图导航
  // ═══════════════════════════════════════════════════════════

  /** 从主视图进入子视图 */
  navigateTo(view) {
    if (this.data.currentView === view) return; // 幂等
    const MAP = {
      goal: '个人目标',
      achievements: '成就勋章',
      theme: '主题设置',
      export: '数据导出',
      help: '帮助与反馈',
      about: '关于',
    };
    this.setData({
      currentView: view,
      subViewTitle: MAP[view] || '',
    });
  },

  /** 子视图返回主视图 */
  navigateBack() {
    this.setData({ currentView: 'main', subViewTitle: '' });
  },

  // ═══════════════════════════════════════════════════════════
  //  数据加载
  // ═══════════════════════════════════════════════════════════

  async _loadProfile() {
    // 1. 读取本地登录态
    const loginState = getLoginState();
    if (!loginState.isLoggedIn || !loginState.openid) {
      this._setLoggedOut();
      return;
    }

    // 2. 已登录：从 API 获取真实数据
    try {
      const [infoRes, settingsRes] = await Promise.all([
        userAPI.getInfo(),
        userAPI.getSettings(),
      ]);

      // 3. 如果用户身份失效，清理登录态
      if (infoRes.code === 401 || infoRes.code === 404) {
        this._setLoggedOut();
        wx.showToast({ title: infoRes.code === 404 ? '用户不存在，请重新登录' : '登录已失效', icon: 'none' });
        return;
      }

      if (infoRes.code !== 0) {
        wx.showToast({ title: infoRes.message || '用户信息加载失败', icon: 'none' });
        this._setLoggedOut();
        return;
      }

      if (settingsRes.code === 401 || settingsRes.code === 404) {
        this._setLoggedOut();
        wx.showToast({ title: settingsRes.code === 404 ? '用户设置不存在，请重新登录' : '登录已失效', icon: 'none' });
        return;
      }

      if (settingsRes.code !== 0) {
        wx.showToast({ title: settingsRes.message || '设置加载失败', icon: 'none' });
      }

      const userInfo = infoRes.data;
      const settings = settingsRes.code === 0 ? settingsRes.data : null;

      app.globalData.userInfo = userInfo;
      app.globalData.isLoggedIn = true;
      this.setData({
        isLoggedIn: true,
        userInfo,
        settings,
        avatarUrl: userInfo.avatarUrl || '',
        nickName: userInfo.nickName || '微信用户',
      });

      // 登录成功后异步加载统计数据
      this._loadStats();
    } catch (err) {
      console.warn('[profile] load profile error:', err);
      wx.showToast({ title: '用户信息加载失败', icon: 'none' });
      this._setLoggedOut();
    }
  },

  /** 🐛 修复：从 API 加载统计摘要和本月目标数据 */
  async _loadStats() {
    if (!this.data.isLoggedIn) return;

    try {
      const [monthlyRes] = await Promise.all([
        statsAPI.monthly(),
      ]);

      const monthly = extractData(monthlyRes, {});

      // 本月目标数据
      const totalMinutes = monthly.totalFocusMinutes || 0;
      const monthlyCurrent = Math.round((totalMinutes / 60) * 10) / 10; // 转为小时，保留 1 位
      const monthlyTarget = this.data.monthlyGoalTarget; // 从设置获取，默认 50
      const progress = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyCurrent / monthlyTarget) * 100)) : 0;
      const remain = Math.max(0, Math.round((monthlyTarget - monthlyCurrent) * 10) / 10);

      // 摘要
      const totalPomodoros = monthly.totalPomodoros || 0;
      const activeDays = monthly.activeDays || 0;

      this.setData({
        summaryStats: [
          { icon: '⏱️', value: formatDuration(totalMinutes), label: '累计专注' },
          { icon: '🔥', value: `${activeDays}天`, label: '连续打卡' },
          { icon: '🏆', value: `${Math.min(12, Math.floor(totalPomodoros / 10))}个`, label: '获得勋章' },
        ],
        monthlyGoalCurrent: monthlyCurrent,
        monthlyGoalProgress: progress,
        goalRemain: remain,
      });
    } catch (err) {
      console.warn('[profile] load stats error:', err);
      // 兜底值已在 data 中预设，不崩溃
    }
  },

  _setLoggedOut() {
    clearLoginState();
    app.globalData.userInfo = null;
    app.globalData.isLoggedIn = false;
    this.setData({ isLoggedIn: false, userInfo: null, settings: null });
  },

  // 未登录时点击头像跳转登录页
  onAvatarTap() {
    if (!this.data.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  // chooseAvatar：用户主动选择微信头像（先预览，点击保存后上传）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) return;

    this.setData({ avatarUrl, profileDirty: true });
  },

  // type="nickname" 输入框失焦时收集昵称（点击保存后统一提交）
  onNicknameBlur(e) {
    const nickName = (e.detail.value || '').trim();
    if (!nickName || nickName === this.data.nickName) return;

    this.setData({ nickName, profileDirty: true });
  },

  _isTempAvatarPath(avatarUrl) {
    return /^wxfile:\/\//.test(avatarUrl) || /^http:\/\/tmp\//.test(avatarUrl) || /^https?:\/\/tmp\//.test(avatarUrl);
  },

  _uploadAvatar(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath: `avatars/${this.data.userInfo?._id || 'unknown'}_${Date.now()}.png`,
        filePath: tempFilePath,
        success: (uploadRes) => resolve(uploadRes.fileID),
        fail: reject,
      });
    });
  },

  async onSaveProfile() {
    if (!this.data.profileDirty || this.data.profileSubmitting) return;

    const nickName = (this.data.nickName || '').trim();
    if (!nickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    this.setData({ profileSubmitting: true });
    wx.showLoading({ title: '保存中...' });

    try {
      let finalAvatarUrl = this.data.avatarUrl;
      if (finalAvatarUrl && this._isTempAvatarPath(finalAvatarUrl)) {
        finalAvatarUrl = await this._uploadAvatar(finalAvatarUrl);
      }

      const res = await userAPI.updateProfile({ nickName, avatarUrl: finalAvatarUrl });
      if (res.code !== 0) {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
        return;
      }

      const userInfo = res.data;
      app.globalData.userInfo = userInfo;
      saveLoginState({ openid: getLoginState().openid, user: userInfo });
      this.setData({
        userInfo,
        avatarUrl: userInfo.avatarUrl || finalAvatarUrl || '',
        nickName: userInfo.nickName || nickName,
        profileDirty: false,
      });
      wx.showToast({ title: '资料已保存', icon: 'success' });
    } catch (err) {
      console.warn('[profile] save profile failed:', err);
      wx.showToast({ title: '资料保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ profileSubmitting: false });
    }
  },

  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },

  /** 菜单点击路由：子视图 / AI 教练跳转 / 占位 Toast */
  onMenuItemTap(e) {
    const { key } = e.currentTarget.dataset;
    const VIEW_KEYS = ['goal', 'achievements', 'theme', 'export', 'help', 'about'];

    if (key === 'coach') {
      wx.redirectTo({ url: '/pages/coach/coach' });
    } else if (VIEW_KEYS.includes(key)) {
      this.navigateTo(key);
    } else {
      wx.showToast({ title: key, icon: 'none' });
    }
  },

  onSwitchTap(e) {
    const key = e.currentTarget.dataset.key;
    const items = this.data.settingMenu.map(item => {
      if (item.key === key && item.type === 'switch') {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    });
    this.setData({ settingMenu: items });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this._setLoggedOut();
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      },
    });
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
