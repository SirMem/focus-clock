App({
  onLaunch() {
    // 初始化云开发环境
    // ⚠️ 请将 'your-env-id' 替换为你的微信云开发环境 ID
    wx.cloud.init({
      env: 'focus-d1g1k2nxl1bc84dd8',
      traceUser: true
    });
  },
  globalData: {
    userInfo: null,
    isLoggedIn: false
  }
});
