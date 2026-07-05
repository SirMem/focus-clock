const app = getApp();
const userAPI = require('../../miniprogram/api/user.api');
const { getLoginState, clearLoginState } = require('../../miniprogram/api/auth');

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    isLoggedIn: false,
    userInfo: null,
    settings: null,

    featureMenu: [
      { icon: '🎯', label: '个人目标', desc: '本月已完成 65%', key: 'goal' },
      { icon: '🤖', label: 'AI 教练', desc: '查看今日建议', key: 'coach', badge: '92分', badgeColor: '#34C759' },
      { icon: '🏆', label: '成就勋章', desc: '已获得 6 个勋章', key: 'achievement' },
    ],

    settingMenu: [
      { icon: '🔔', label: '通知提醒', desc: '开启番茄完成提醒', key: 'notification', type: 'switch', enabled: true },
      { icon: '🔊', label: '音效', desc: '专注计时音效', key: 'sound', type: 'switch', enabled: true },
      { icon: '🎨', label: '主题模式', desc: '浅色模式', key: 'theme' },
      { icon: '📊', label: '数据导出', desc: '导出专注数据', key: 'export' },
    ],

    aboutMenu: [
      { icon: 'ℹ️', label: '关于', desc: '版本 2.1.0', key: 'about' },
      { icon: '💬', label: '帮助与反馈', desc: '联系开发者', key: 'feedback' },
      { icon: '⭐', label: '给我们评分', desc: '在小程序中心', key: 'rate' },
    ],
  },

  async onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });

    // 1. 读取本地登录态
    const loginState = getLoginState();
    if (!loginState.isLoggedIn) {
      this.setData({ isLoggedIn: false });
      return;
    }

    // 2. 已登录：从 API 获取真实数据
    try {
      const [infoRes, settingsRes] = await Promise.all([
        userAPI.getInfo(),
        userAPI.getSettings(),
      ]);

      // 3. 如果用户数据 404，清理登录态
      if (infoRes.code === 404) {
        clearLoginState();
        this.setData({ isLoggedIn: false });
        return;
      }

      const userInfo = infoRes.code === 0 ? infoRes.data : null;
      const settings = settingsRes.code === 0 ? settingsRes.data : null;

      this.setData({
        isLoggedIn: true,
        userInfo,
        settings,
      });
    } catch (err) {
      console.warn('[profile] onLoad error:', err);
      this.setData({ isLoggedIn: false });
    }
  },

  onAvatarTap() {
    if (!this.data.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  onSettingsTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },

  onMenuItemTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'coach') {
      wx.redirectTo({ url: '/pages/coach/coach' });
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
          clearLoginState();
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          this.setData({ isLoggedIn: false, userInfo: null, settings: null });
        }
      },
    });
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
