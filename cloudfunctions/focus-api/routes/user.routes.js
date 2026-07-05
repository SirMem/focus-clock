/**
 * user.routes.js — 用户模块路由
 *
 * 路由: user/login, user/info, user/settings/get, user/settings/update
 * 契约: docs/dev-specs/04-user.md
 *
 * 注意：User 模块不需要 service 层，路由直接调用 repo。
 * 因为 user/login 和 settings 读写操作简单直接，不需要中间业务逻辑层。
 */

const UserRepo = require('../repositories/user.repo');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

function getOpenId(ctx) {
  const event = ctx.event || {};
  const userInfo = event.userInfo || {};

  try {
    if (ctx.cloud && typeof ctx.cloud.auth === 'function') {
      const authInfo = ctx.cloud.auth().getUserInfo();
      return authInfo.openId || authInfo.OPENID || '';
    }
  } catch (err) {
    console.warn('[user/login] getUserInfo failed:', err && err.message ? err.message : err);
  }

  if (userInfo.OPENID) return userInfo.OPENID;
  if (userInfo.openId) return userInfo.openId;

  return '';
}

function logOpenIdMissing(ctx) {
  const event = ctx.event || {};
  console.warn('[user/login] OPENID missing', {
    hasEvent: !!ctx.event,
    hasUserInfo: !!event.userInfo,
    eventKeys: Object.keys(event),
  });
}

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  user/login
  //
  //  注意：user/login 由 auth 白名单放行。
  //  因为用户此时尚未登录，OPENID 需从云函数调用上下文获取。
  // ═══════════════════════════════════════════════════

  app.router('user/login', async (ctx) => {
    const { nickName, avatarUrl } = ctx.event || {};

    const openId = getOpenId(ctx);

    if (!openId) {
      logOpenIdMissing(ctx);
      fail(ctx, 401, '获取用户身份失败');
      return;
    }

    const repo = UserRepo.create();
    const user = await repo.upsertUser(openId, { nickName, avatarUrl });

    succ(ctx, {
      openid: openId,
      user: {
        _id: user._id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
      },
    });
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/get
  // ═══════════════════════════════════════════════════

  app.router('user/settings/get', async (ctx) => {
    const repo = UserRepo.create();
    const settings = await repo.getSettings(ctx.OPENID);
    succ(ctx, settings || { focusDuration: 25, shortBreak: 5, longBreak: 15, dailyGoal: 4 });
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/update
  // ═══════════════════════════════════════════════════

  app.router('user/settings/update', async (ctx) => {
    const { settings } = ctx.event;

    if (!settings || typeof settings !== 'object') {
      fail(ctx, 400, '设置数据不能为空');
      return;
    }

    const repo = UserRepo.create();
    await repo.updateSettings(ctx.OPENID, settings);
    succ(ctx, { updated: true });
  });

  // ═══════════════════════════════════════════════════
  //  user/info
  // ═══════════════════════════════════════════════════

  app.router('user/info', async (ctx) => {
    const repo = UserRepo.create();
    const user = await repo.findByOpenId(ctx.OPENID);
    if (!user) {
      fail(ctx, 404, '用户不存在');
      return;
    }
    succ(ctx, {
      _id: user._id,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  });
};
