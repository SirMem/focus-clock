/**
 * user.routes.js — 用户模块路由
 *
 * 路由: user/login, user/info, user/profile/update, user/settings/get, user/settings/update
 * 契约: docs/dev-specs/04-user.md
 *
 * 注意：User 模块不需要 service 层，路由直接调用 repo。
 * 因为 user/login 和 settings 读写操作简单直接，不需要中间业务逻辑层。
 */

const UserRepo = require('../repositories/user.repo');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');
const https = require('https');

const APPID = 'wx696d6c0fd6fc79a6';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`WeChat API status ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error('WeChat API timeout'));
    });
    req.on('error', reject);
  });
}

async function code2Session(code) {
  const secret = process.env.WX_APP_SECRET || process.env.APP_SECRET;
  if (!secret) {
    throw new Error('WX_APP_SECRET not configured');
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session'
    + `?appid=${encodeURIComponent(APPID)}`
    + `&secret=${encodeURIComponent(secret)}`
    + `&js_code=${encodeURIComponent(code)}`
    + '&grant_type=authorization_code';

  const data = await requestJson(url);
  if (data.errcode) {
    throw new Error(data.errmsg || `code2session failed: ${data.errcode}`);
  }
  return data;
}

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

    let openId = '';

    try {
      const session = await code2Session(code);
      openId = session.openid || session.openId || '';
    } catch (err) {
      const message = err && err.message ? err.message : '';
      console.warn('[user/login] code2Session failed:', message || err);
      if (message.includes('WX_APP_SECRET')) {
        fail(ctx, 500, '云函数缺少 WX_APP_SECRET，请在云开发环境变量中配置小程序 AppSecret 并重新部署');
        return;
      }
      fail(ctx, 401, `微信登录校验失败${message ? `：${message}` : ''}`);
      return;
    }

    if (!openId) {
      logOpenIdMissing(ctx);
      fail(ctx, 401, '获取用户身份失败');
      return;
    }

    const repo = UserRepo.create();
    const user = await repo.upsertUser(openId, {});

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
      succ(ctx, {
        _id: user._id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        updatedAt: user.updatedAt,
      });
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
