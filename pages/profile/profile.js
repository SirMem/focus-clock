const app = getApp();
const userAPI = require('../../miniprogram/api/user.api');
const { getLoginState, saveLoginState, clearLoginState } = require('../../miniprogram/api/auth');

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    isLoggedIn: false,
    userInfo: null,
    settings: null,

    // 可编辑的用户资料（chooseAvatar + type=nickname）
    avatarUrl: '',
    nickName: '',
    profileDirty: false,
    profileSubmitting: false,

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

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    this.setData({ statusBarHeight, capsuleHeight: 44 });
  },

  onShow() {
    this._loadProfile();
  },

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
    } catch (err) {
      console.warn('[profile] load profile error:', err);
      wx.showToast({ title: '用户信息加载失败', icon: 'none' });
      this._setLoggedOut();
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

  onMenuItemTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'coach') {
      wx.redirectTo({ url: '/pages/coach/coach' });
    } else {
      wx.showToast({ title: key, icon: 'none' });
    }
  },

  onSwitchTap(e) {
    // P0: 通知/音效等偏好暂为本地 UI 开关；后续若接入后端设置再调用 userAPI.updateSettings。
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
