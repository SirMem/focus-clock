/**
 * auth 中间件 —— OPENID 鉴权
 *
 * 从微信云函数调用上下文提取 OPENID，注入到 ctx.OPENID。
 * 如果没有 OPENID，直接短路返回 401。
 *
 * 注意：user/login 路由不需要鉴权（用户还没登录），在此放行。
 *
 * 用法（在 index.js 中）：
 *   const auth = require('./middleware/auth');
 *   app.use(auth);                    // 全局启用（自动跳过 user/login）
 */

const { CODES, MESSAGES } = require('../config');
const { getOpenId } = require('../utils/cloud');

// 不需要鉴权的路由（白名单）
const NO_AUTH_ROUTES = ['user/login'];

module.exports = async (ctx, next) => {
  // 安全守卫：ctx.event 可能为 undefined（tcb-router 初始化边缘情况）
  if (!ctx.event || !ctx.event.$url) {
    await next();
    return;
  }

  // 白名单路由直接放行
  if (NO_AUTH_ROUTES.includes(ctx.event.$url)) {
    ctx.OPENID = null;
    console.log("放行")
    await next();
    return;
  }

  const openId = getOpenId();

  if (!openId) {
    ctx.body = { code: CODES.ERR_UNAUTHORIZED, message: MESSAGES[CODES.ERR_UNAUTHORIZED] };
    return; // 不调用 next()，直接短路
  }

  ctx.OPENID = openId;
  await next();
};
