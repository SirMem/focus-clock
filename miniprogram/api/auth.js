const LOGIN_STATE_KEYS = ['openid', 'isLoggedIn', 'userInfo'];

/**
 * 保存本地登录态
 * @param {{ openid: string, user?: object }} param0
 */
function saveLoginState({ openid, user }) {
  wx.setStorageSync('openid', openid);
  wx.setStorageSync('isLoggedIn', true);
  wx.setStorageSync('userInfo', JSON.stringify(user || {}));
}

/**
 * 清理本地登录态
 */
function clearLoginState() {
  LOGIN_STATE_KEYS.forEach(key => {
    wx.removeStorageSync(key);
  });
}

/**
 * 读取本地登录态
 * @returns {{ openid: string, isLoggedIn: boolean, userInfo: object }}
 */
function getLoginState() {
  const openid = wx.getStorageSync('openid');
  const isLoggedInValue = wx.getStorageSync('isLoggedIn');
  const rawUserInfo = wx.getStorageSync('userInfo');
  let userInfo = {};

  try {
    userInfo = rawUserInfo ? JSON.parse(rawUserInfo) : {};
  } catch (err) {
    console.warn('[auth] failed to parse userInfo:', err);
    userInfo = {};
  }

  return {
    openid,
    isLoggedIn: !!isLoggedInValue,
    userInfo,
  };
}

/**
 * 是否已登录
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!wx.getStorageSync('isLoggedIn') && !!wx.getStorageSync('openid');
}

module.exports = {
  saveLoginState,
  clearLoginState,
  getLoginState,
  isLoggedIn,
};
