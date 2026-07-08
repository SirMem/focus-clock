/**
 * user.service.js —— 用户模块业务逻辑层
 *
 * 职责:
 *   1. user/login          — 微信 code2Session + upsert 用户
 *   2. user/info           — 查询用户信息
 *   3. user/profile/update — 更新头像昵称
 *   4. user/settings/get   — 获取设置（含默认值合并）
 *   5. user/settings/update— 更新设置（字段白名单过滤）
 *
 * 依赖: UserRepo
 * 契约: docs/dev-specs/04-user.md
 * 参考: docs/known-issues.md §P3-1
 */

const UserRepo = require('../repositories/user.repo');
const { AppError } = require('../utils/app-error');
const https = require('https');

const APPID = 'wx696d6c0fd6fc79a6';

// ─── 微信 code2Session ──────────────────────────────────────────

/**
 * 发起 HTTPS GET 请求并解析 JSON
 * @param {string} url
 * @returns {Promise<object>}
 */
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

/**
 * 调用微信 jscode2session 接口
 * @param {string} code - 小程序端 wx.login() 返回的临时 code
 * @returns {Promise<{openid: string, session_key: string}>}
 */
async function code2Session(code) {
  const secret = process.env.WX_APP_SECRET || process.env.APP_SECRET;
  if (!secret) {
    throw new AppError(500, '云函数缺少 WX_APP_SECRET，请在云开发环境变量中配置小程序 AppSecret 并重新部署');
  }

  const url = 'https://api.weixin.qq.com/sns/jscode2session'
    + `?appid=${encodeURIComponent(APPID)}`
    + `&secret=${encodeURIComponent(secret)}`
    + `&js_code=${encodeURIComponent(code)}`
    + '&grant_type=authorization_code';

  const data = await requestJson(url);
  if (data.errcode) {
    throw new AppError(401, `微信登录校验失败：${data.errmsg || `errcode=${data.errcode}`}`);
  }
  return data;
}

// ─── UserService ────────────────────────────────────────────────

class UserService {

  /**
   * @param {UserRepo} userRepo
   */
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  /**
   * 工厂方法
   * @returns {UserService}
   */
  static create() {
    return new UserService(UserRepo.create());
  }

  /**
   * 微信登录 — code2Session + upsert 用户
   *
   * @param {string} code - wx.login() 返回的临时 code
   * @returns {Promise<{openid: string, user: object}>}
   */
  async login(code) {
    const session = await code2Session(code);
    const openId = session.openid || session.openId || '';

    if (!openId) {
      throw new AppError(401, '获取用户身份失败');
    }

    const user = await this.userRepo.upsertUser(openId, {});

    return {
      openid: openId,
      user: {
        _id: user._id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * 查询用户信息
   *
   * @param {string} openId
   * @returns {Promise<{_id: string, nickName: string, avatarUrl: string, createdAt: number}>}
   */
  async getInfo(openId) {
    const user = await this.userRepo.findByOpenId(openId);
    if (!user) {
      throw new AppError(404, '用户不存在');
    }

    return {
      _id: user._id,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  /**
   * 更新用户头像昵称
   *
   * @param {string} openId
   * @param {{ nickName?: string, avatarUrl?: string }} profile
   * @returns {Promise<{_id: string, nickName: string, avatarUrl: string, updatedAt: number}>}
   */
  async updateProfile(openId, profile) {
    try {
      const user = await this.userRepo.updateProfile(openId, profile);
      return {
        _id: user._id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        updatedAt: user.updatedAt,
      };
    } catch (err) {
      if (err && err.message === 'USER_NOT_FOUND') {
        throw new AppError(404, '用户不存在');
      }
      throw err;
    }
  }

  /**
   * 获取用户设置（含默认值合并）
   *
   * @param {string} openId
   * @returns {Promise<object>}
   */
  async getSettings(openId) {
    const settings = await this.userRepo.getSettings(openId);
    return settings || { focusDuration: 25, shortBreak: 5, longBreak: 15, dailyGoal: 4 };
  }

  /**
   * 更新用户设置（字段白名单过滤在 Repo 层完成）
   *
   * @param {string} openId
   * @param {object} settings
   * @returns {Promise<{updated: boolean}>}
   */
  async updateSettings(openId, settings) {
    await this.userRepo.updateSettings(openId, settings);
    return { updated: true };
  }

}

module.exports = UserService;
