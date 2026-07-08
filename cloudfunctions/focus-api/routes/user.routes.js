/**
 * user.routes.js — 用户模块路由
 *
 * 路由: user/login, user/info, user/profile/update, user/settings/get, user/settings/update
 * 契约: docs/dev-specs/04-user.md
 *
 * P3-1: 路由层只做参数校验 + 调用 UserService + 返回。
 * 业务逻辑（code2Session、upsert、profile 校验）下沉到 UserService。
 */

const UserService = require('../services/user.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

/**
 * 校验并规范化用户资料更新请求
 * @returns {{ error?: string, profile?: { nickName?: string, avatarUrl?: string } }}
 */
function normalizeProfile({ nickName, avatarUrl } = {}) {
  const profile = {};

  if (nickName !== undefined) {
    if (typeof nickName !== 'string') {
      return { error: '昵称格式不正确' };
    }
    const cleanNickName = nickName.trim();
    if (cleanNickName.length > 20) {
      return { error: '昵称不能超过 20 个字符' };
    }
    if (cleanNickName) profile.nickName = cleanNickName;
  }

  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== 'string') {
      return { error: '头像格式不正确' };
    }
    const cleanAvatarUrl = avatarUrl.trim();
    if (cleanAvatarUrl.length > 500) {
      return { error: '头像地址过长' };
    }
    if (cleanAvatarUrl && !/^cloud:\/\//.test(cleanAvatarUrl) && !/^https:\/\//.test(cleanAvatarUrl)) {
      return { error: '头像地址不合法' };
    }
    if (cleanAvatarUrl) profile.avatarUrl = cleanAvatarUrl;
  }

  if (!profile.nickName && !profile.avatarUrl) {
    return { error: '用户资料不能为空' };
  }

  return { profile };
}

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  user/login
  //
  //  注意：user/login 由 auth 白名单放行。
  //  因为用户此时尚未登录，OPENID 需从云函数调用上下文获取。
  // ═══════════════════════════════════════════════════

  app.router('user/login', async (ctx) => {
    const { code } = ctx.event || {};

    if (!code) {
      fail(ctx, 400, '登录 code 不能为空');
      return;
    }

    try {
      const service = UserService.create();
      const result = await service.login(code);
      succ(ctx, result);
    } catch (err) {
      if (err.name === 'AppError') {
        fail(ctx, err.code, err.message);
        return;
      }
      throw err;
    }
  });

  // ═══════════════════════════════════════════════════
  //  user/profile/update
  // ═══════════════════════════════════════════════════

  app.router('user/profile/update', async (ctx) => {
    const normalized = normalizeProfile(ctx.event || {});
    if (normalized.error) {
      fail(ctx, 400, normalized.error);
      return;
    }

    try {
      const service = UserService.create();
      const result = await service.updateProfile(ctx.OPENID, normalized.profile);
      succ(ctx, result);
    } catch (err) {
      if (err.name === 'AppError') {
        fail(ctx, err.code, err.message);
        return;
      }
      throw err;
    }
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/get
  // ═══════════════════════════════════════════════════

  app.router('user/settings/get', async (ctx) => {
    const service = UserService.create();
    const settings = await service.getSettings(ctx.OPENID);
    succ(ctx, settings);
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

    const service = UserService.create();
    await service.updateSettings(ctx.OPENID, settings);
    succ(ctx, { updated: true });
  });

  // ═══════════════════════════════════════════════════
  //  user/info
  // ═══════════════════════════════════════════════════

  app.router('user/info', async (ctx) => {
    try {
      const service = UserService.create();
      const result = await service.getInfo(ctx.OPENID);
      succ(ctx, result);
    } catch (err) {
      if (err.name === 'AppError') {
        fail(ctx, err.code, err.message);
        return;
      }
      throw err;
    }
  });
};
