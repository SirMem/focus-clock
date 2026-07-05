/**
 * user.repo.js —— Users 集合数据访问层
 *
 * 提供用户登录（upsert）、信息查询、设置读写等基础操作。
 * 所有方法不包含业务逻辑，只做 CRUD。
 *
 * 路由层引用路径: routes/user.routes.js → require('../repositories/user.repo')
 */

class UserRepo {

  constructor(db) {
    this.collection = db.collection('users');
  }

  /**
   * 工厂方法
   * @returns {UserRepo}
   */
  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new UserRepo(app.database());
  }

  /**
   * 按 OPENID 查找用户
   * @param {string} openId
   * @returns {Promise<object|null>}
   */
  async findByOpenId(openId) {
    const res = await this.collection.where({ _openid: openId }).get();
    return res.data[0] || null;
  }

  /**
   * 登录时创建或更新用户信息（upsert 语义）
   *
   * 存在 → 更新 nickName/avatarUrl/lastLoginAt
   * 不存在 → 创建新用户文档含默认 settings
   *
   * @param {string} openId
   * @param {{ nickName?: string, avatarUrl?: string }} userData
   * @returns {Promise<object>} 完整用户文档
   */
  async upsertUser(openId, { nickName, avatarUrl } = {}) {
    const existing = await this.findByOpenId(openId);
    const now = Date.now();

    if (existing) {
      const updateData = { updatedAt: now, lastLoginAt: now };
      if (nickName) updateData.nickName = nickName;
      if (avatarUrl) updateData.avatarUrl = avatarUrl;
      await this.collection.doc(existing._id).update({ data: updateData });
      return { ...existing, ...updateData, _id: existing._id };
    }

    // 新用户，带默认设置
    const newUser = {
      _openid: openId,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      settings: {
        focusDuration: 25,
        shortBreak: 5,
        longBreak: 15,
        dailyGoal: 4,
      },
    };
    const res = await this.collection.add({ data: newUser });
    return { _id: res.id, ...newUser };
  }

  /**
   * 获取用户设置
   * @param {string} openId
   * @returns {Promise<object|null>}
   */
  async getSettings(openId) {
    const user = await this.findByOpenId(openId);
    return user ? user.settings : null;
  }

  /**
   * 更新用户设置
   * @param {string} openId
   * @param {object} settings - 设置字段（如 { dailyGoal: 8 }）
   * @returns {Promise<void>}
   */
  async updateSettings(openId, settings) {
    // 只允许更新 settings 下指定的字段
    const allowedFields = ['focusDuration', 'shortBreak', 'longBreak', 'dailyGoal'];
    const cleanSettings = {};
    for (const key of allowedFields) {
      if (settings[key] !== undefined) {
        cleanSettings[key] = settings[key];
      }
    }
    await this.collection.where({ _openid: openId }).update({
      data: { settings: cleanSettings, updatedAt: Date.now() },
    });
  }

}

module.exports = UserRepo;
