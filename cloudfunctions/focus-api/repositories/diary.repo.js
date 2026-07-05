/**
 * diary.repo.js — 日记数据访问层
 *
 * 操作 diaries 集合，提供 CRUD 基础方法。
 * 所有方法通过 this.collection 操作云数据库。
 *
 * 契约: docs/api-contracts.md §5
 * 集合: diaries
 * 索引: _openid + createdAt
 */

const COLLECTION_NAME = 'diaries';

class DiaryRepo {
  constructor(db) {
    this.db = db;
    this.collection = db.collection(COLLECTION_NAME);
  }

  /**
   * 工厂方法 —— 自动初始化云数据库环境
   */
  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new DiaryRepo(app.database());
  }

  /**
   * 插入一条日记文档
   * @param {object} data - 完整的 diary 文档数据
   * @returns {Promise<{ _id: string, ...data }>}
   */
  async insert(data) {
    const res = await this.collection.add({ data });
    return { _id: res.id, ...data };
  }

  /**
   * 按条件分页查询（按 createdAt 降序）
   * @param {object} where - 查询条件
   * @param {object} opts - { page, pageSize }
   * @returns {Promise<object[]>}
   */
  async findAll(where, { page = 1, pageSize = 20 } = {}) {
    const res = await this.collection
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return res.data;
  }

  /**
   * 按 ID 查询单条
   * @param {string} id - 文档 _id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    const res = await this.collection.doc(id).get();
    return res.data[0] || null;
  }

  /**
   * 按 ID 更新（自动注入 updatedAt）
   * @param {string} id - 文档 _id
   * @param {object} data - 要更新的字段
   * @returns {Promise<{ updated: number }>}
   */
  async updateById(id, data) {
    const res = await this.collection.doc(id).update({
      data: { ...data, updatedAt: Date.now() },
    });
    return { updated: res.updated };
  }

  /**
   * 按 ID 删除
   * @param {string} id - 文档 _id
   * @returns {Promise<{ deleted: number }>}
   */
  async deleteById(id) {
    const res = await this.collection.doc(id).remove();
    return { deleted: res.deleted || 0 };
  }

  /**
   * 按条件计数
   * @param {object} where - 查询条件
   * @returns {Promise<number>}
   */
  async count(where) {
    const res = await this.collection.where(where).count();
    return res.total;
  }
}

module.exports = DiaryRepo;
