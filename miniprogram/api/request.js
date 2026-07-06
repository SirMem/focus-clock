/**
 * request.js —— 云函数调用封装
 *
 * 统一封装 wx.cloud.callFunction，提供便捷的调用入口。
 * 所有 api/*.api.js 模块都基于此文件。
 *
 * 用法:
 *   const { callAPI } = require('./request');
 *   const res = await callAPI('task/list', { filter: { isDone: false } });
 */

const { clearLoginState } = require('./auth');

const LOGIN_PAGE_URL = '/pages/login/login';
let isRedirectingToLogin = false;

/**
 * 处理未登录响应
 * @param {{ redirectOnUnauthorized?: boolean }} options
 */
function handleUnauthorized(options = {}) {
  clearLoginState();

  if (options.redirectOnUnauthorized !== false && !isRedirectingToLogin) {
    isRedirectingToLogin = true;
    wx.reLaunch({
      url: LOGIN_PAGE_URL,
      fail(err) {
        isRedirectingToLogin = false;
        console.warn('[callAPI] redirect to login failed:', err);
      },
    });
  }
}

/**
 * 调用云函数接口
 * @param {string} url - 路由标识，格式 'module/action'（对应 tcb-router 的 $url）
 * @param {object} data - 请求参数（不含 $url）
 * @param {{ redirectOnUnauthorized?: boolean }} options - 调用选项
 * @returns {Promise<{code: number, data?: any, message: string}>}
 */
function callAPI(url, data = {}, options = {}) {
  const { $url, ...payload } = data;

  return wx.cloud.callFunction({
    name: 'focus-api',
    data: { ...payload, $url: url },
  }).then(res => {
    const result = res && res.result;

    console.log(result);
    if (!result) {
      console.warn('[callAPI] empty cloud function result:', url, res);
      return { code: -1, message: '接口无响应' };
    }

    if (result.code === 401) {
      handleUnauthorized(options);
    }

    return result;
  }).catch(err => {
    console.error('[callAPI] cloud function failed:', url, err);
    throw err;
  });
}

module.exports = { callAPI };
