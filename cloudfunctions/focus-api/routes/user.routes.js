const UserRepo = require('../repositories/user.repo');
const { succ, fail } = require('../middleware/response');
const { getOpenId } = require('../utils/cloud');

function logOpenIdMissing(ctx) {
  const event = ctx.event || {};
  console.warn('[user/login] OPENID missing', {
    hasEvent: !!ctx.event,
    eventKeys: Object.keys(event),
  });
}

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

function mapUserForClient(user) {
  return {
    _id: user._id,
    openid: user._openid,
    nickName: user.nickName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  user/login
  //
  //  静默身份登录：OPENID 来自 wx-server-sdk getWXContext()，不依赖前端传 openid/code。
  // ═══════════════════════════════════════════════════

  app.router('user/login', async (ctx) => {
    const openId = getOpenId();

    if (!openId) {
      logOpenIdMissing(ctx);
      fail(ctx, 401, '获取用户身份失败');
      return;
    }

    const repo = UserRepo.create();
    const user = await repo.upsertUser(openId, {});

    succ(ctx, {
      openid: openId,
      user: mapUserForClient(user),
    });
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

    const repo = UserRepo.create();
    try {
      const user = await repo.updateProfile(ctx.OPENID, normalized.profile);
      succ(ctx, mapUserForClient(user));
    } catch (err) {
      if (err && err.message === 'USER_NOT_FOUND') {
        fail(ctx, 404, '用户不存在');
        return;
      }
      throw err;
    }
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/get
  // ═══════════════════════════════════════════════════

  app.router('user/settings/get', async (ctx) => {
    const repo = UserRepo.create();
    const settings = await repo.getSettings(ctx.OPENID);
    succ(ctx, settings || UserRepo.defaultSettings());
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
    const user = await repo.updateSettings(ctx.OPENID, settings);
    if (!user) {
      fail(ctx, 404, '用户不存在');
      return;
    }
    succ(ctx, user.settings || UserRepo.defaultSettings());
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
    succ(ctx, mapUserForClient(user));
  });
};
