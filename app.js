App({
  onLaunch() {
    // 初始化云开发环境
    // ⚠️ 请将 'your-env-id' 替换为你的微信云开发环境 ID
    wx.cloud.init({
      env: 'focus-on-d8ghhuk5h910beb78',
      traceUser: true
    });
    // 清理上次异常退出可能残留的专注任务锁
    wx.removeStorageSync('focus_active_task');
  },
  globalData: {
    userInfo: null,
    isLoggedIn: false
  }
});
