const { getDb } = require('../utils/cloud');

const USERS_COLLECTION = 'users';

class UserRepo {

  constructor(db) {
    this.collection = db.collection(USERS_COLLECTION);
  }

  /**
   * 工厂方法
   * @returns {UserRepo}
   */
  static create() {
    return new UserRepo(getDb());
  }

  static defaultSettings() {
    return {
      focusDuration: 25,
      shortBreak: 5,
      longBreak: 15,
      dailyGoal: 4,
    };
  }

  _normalizeDocResult(res) {
    if (!res || !res.data) return null;
    if (Array.isArray(res.data)) return res.data[0] || null;
    return res.data;
  }

  _buildUser(openId, now, { nickName, avatarUrl } = {}) {
    return {
      _openid: openId,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      settings: UserRepo.defaultSettings(),
    };
  }

  _pickCanonicalUser(openId, users) {
    const exactIdUser = users.find(user => user._id === openId);
    if (exactIdUser) return exactIdUser;

    return [...users].sort((a, b) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : Number.MAX_SAFE_INTEGER;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : Number.MAX_SAFE_INTEGER;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return String(a._id || '').localeCompare(String(b._id || ''));
    })[0] || null;
  }

  async _findUsersByOpenId(openId) {
    const res = await this.collection.where({ _openid: openId }).get();
    return res.data || [];
  }

  async _removeUsers(users) {
    const removedIds = [];
    for (const user of users) {
      if (!user || !user._id) continue;
      await this.collection.doc(user._id).remove();
      removedIds.push(user._id);
    }
    return removedIds;
  }

  async _ensureCanonicalUser(openId, users) {
    if (users.length === 0) return null;

    const canonical = this._pickCanonicalUser(openId, users);
    const canonicalData = {
      ...canonical,
      _openid: openId,
      nickName: canonical.nickName || '微信用户',
      avatarUrl: canonical.avatarUrl || '',
      settings: { ...UserRepo.defaultSettings(), ...(canonical.settings || {}) },
    };
    delete canonicalData._id;

    const duplicates = users.filter(user => user._id !== openId);

    if (canonical._id !== openId) {
      await this.collection.doc(openId).set({ data: canonicalData });
      await this._removeUsers(duplicates);
      console.warn('[user.repo] migrated duplicate/legacy user to OPENID doc id:', {
        openId,
        fromId: canonical._id,
        removedIds: duplicates.map(user => user._id),
      });
      return { _id: openId, ...canonicalData };
    }

    const duplicateIds = await this._removeUsers(duplicates);
    if (duplicateIds.length > 0) {
      console.warn('[user.repo] removed duplicate users for OPENID:', { openId, duplicateIds });
    }
    return { _id: openId, ...canonicalData };
  }

  /**
   * 按 OPENID 查找用户，并在发现历史重复数据时收敛为 users/{OPENID}。
   * @param {string} openId
   * @returns {Promise<object|null>}
   */
  async findByOpenId(openId) {
    const users = await this._findUsersByOpenId(openId);
    return this._ensureCanonicalUser(openId, users);
  }

  /**
   * 登录时创建或更新用户信息（upsert 语义）
   *
   * 存在 → 更新 nickName/avatarUrl/lastLoginAt
   * 不存在 → 用 OPENID 作为文档 _id 创建新用户，避免同一 OPENID 多个随机 _id
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
      await this.collection.doc(openId).update({ data: updateData });
      return { ...existing, ...updateData, _id: openId };
    }

    const newUser = this._buildUser(openId, now, { nickName, avatarUrl });
    await this.collection.doc(openId).set({ data: newUser });
    return { _id: openId, ...newUser };
  }

  /**
   * 更新用户头像昵称资料
   * @param {string} openId
   * @param {{ nickName?: string, avatarUrl?: string }} profile
   * @returns {Promise<object>} 更新后的用户文档
   */
  async updateProfile(openId, { nickName, avatarUrl } = {}) {
    const existing = await this.findByOpenId(openId);
    if (!existing) {
      throw new Error('USER_NOT_FOUND');
    }

    const updateData = { updatedAt: Date.now() };
    if (nickName) updateData.nickName = nickName;
    if (avatarUrl) updateData.avatarUrl = avatarUrl;

    await this.collection.doc(openId).update({ data: updateData });
    return { ...existing, ...updateData, _id: openId };
  }

  /**
   * 获取用户设置
   * @param {string} openId
   * @returns {Promise<object|null>}
   */
  async getSettings(openId) {
    const user = await this.findByOpenId(openId);
    return user ? { ...UserRepo.defaultSettings(), ...(user.settings || {}) } : null;
  }

  /**
   * 更新用户设置
   * @param {string} openId
   * @param {object} settings - 设置字段（如 { dailyGoal: 8 }）
   * @returns {Promise<object|null>} 更新后的用户文档
   */
  async updateSettings(openId, settings) {
    const user = await this.findByOpenId(openId);
    if (!user) return null;

    const allowedFields = ['focusDuration', 'shortBreak', 'longBreak', 'dailyGoal'];
    const cleanSettings = { ...UserRepo.defaultSettings(), ...(user.settings || {}) };
    for (const key of allowedFields) {
      if (settings[key] !== undefined) {
        cleanSettings[key] = settings[key];
      }
    }

    const updateData = { settings: cleanSettings, updatedAt: Date.now() };
    await this.collection.doc(openId).update({ data: updateData });
    return { ...user, ...updateData, _id: openId };
  }

  /**
   * 清理 users 集合中的重复 OPENID 文档。
   * @param {{ dryRun?: boolean }} options
   * @returns {Promise<{dryRun: boolean, groups: Array, removedCount: number}>}
   */
  async cleanupDuplicateUsers({ dryRun = true } = {}) {
    const res = await this.collection.limit(1000).get();
    const groupsByOpenId = new Map();

    for (const user of res.data || []) {
      if (!user || !user._openid) continue;
      const group = groupsByOpenId.get(user._openid) || [];
      group.push(user);
      groupsByOpenId.set(user._openid, group);
    }

    const groups = [];
    let removedCount = 0;

    for (const [openId, users] of groupsByOpenId.entries()) {
      if (users.length <= 1 && users[0]._id === openId) continue;

      const canonical = this._pickCanonicalUser(openId, users);
      const canonicalId = openId;
      const removeTargets = users.filter(user => user._id !== canonicalId);
      const groupResult = {
        openid: openId,
        canonicalId,
        sourceId: canonical?._id || null,
        duplicateIds: removeTargets.map(user => user._id),
      };
      groups.push(groupResult);

      if (!dryRun) {
        const canonicalData = {
          ...canonical,
          _openid: openId,
          nickName: canonical?.nickName || '微信用户',
          avatarUrl: canonical?.avatarUrl || '',
          settings: { ...UserRepo.defaultSettings(), ...(canonical?.settings || {}) },
        };
        delete canonicalData._id;
        await this.collection.doc(canonicalId).set({ data: canonicalData });
        await this._removeUsers(removeTargets);
        removedCount += removeTargets.length;
      }
    }

    return { dryRun, groups, removedCount };
  }

}

module.exports = UserRepo;
