/**
 * session.repo.js —— Sessions 集合数据访问层
 *
 * 操作数据库 sessions 集合，提供插入、分页查询、计数和当日会话查询。
 * 所有方法不包含业务逻辑，只做 CRUD。
 *
 * 契约: docs/api-contracts.md §3
 */

class SessionRepo {

  constructor(db) {
    this.collection = db.collection('sessions');
    this._ = db.command;
  }

  /**
   * 工厂方法
   * @returns {SessionRepo}
   */
  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new SessionRepo(app.database());
  }

  /**
   * 插入一条会话记录
   * @param {object} data - 会话文档
   * @returns {Promise<object>} 插入后的完整文档（含 _id）
   */
  async insert(data) {
    const res = await this.collection.add({ data });
    return { _id: res.id, ...data };
  }

  /**
   * 分页查询会话，按 completedAt 降序
   * @param {object} where - 查询条件
   * @param {{ page?: number, pageSize?: number }} [pagination]
   * @returns {Promise<object[]>}
   */
  async findAll(where, { page = 1, pageSize = 20 } = {}) {
    const res = await this.collection
      .where(where)
      .orderBy('completedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return res.data;
  }

  /**
   * 计数
   * @param {object} where - 查询条件
   * @returns {Promise<number>}
   */
  async count(where) {
    const res = await this.collection.where(where).count();
    return res.total;
  }

  /**
   * 查询当日所有专注会话
   * @param {string} openId
   * @returns {Promise<object[]>}
   */
  async getTodaySessions(openId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.collection
      .where({
        _openid: openId,
        completedAt: this._.gte(todayStart.getTime()),
      })
      .get()
      .then(res => res.data);
  }

  /**
   * 按日期范围分页查询
   * @param {string} openId
   * @param {string} [startDate] - YYYY-MM-DD 起始日期
   * @param {string} [endDate]   - YYYY-MM-DD 结束日期
   * @param {{ page?: number, pageSize?: number }} [pagination]
   * @returns {Promise<object[]>}
   */
  async findByDateRange(openId, startDate, endDate, { page = 1, pageSize = 20 } = {}) {
    const where = this._buildDateRangeWhere(openId, startDate, endDate);
    return this.findAll(where, { page, pageSize });
  }

  /**
   * 按日期范围计数
   * @param {string} openId
   * @param {string} [startDate]
   * @param {string} [endDate]
   * @returns {Promise<number>}
   */
  async countByDateRange(openId, startDate, endDate) {
    const where = this._buildDateRangeWhere(openId, startDate, endDate);
    return this.count(where);
  }

  /**
   * 构建日期范围查询条件
   * @private
   */
  _buildDateRangeWhere(openId, startDate, endDate) {
    const where = { _openid: openId };
    if (startDate || endDate) {
      const gte = startDate ? new Date(startDate).getTime() : 0;
      const lte = endDate
        ? new Date(endDate + 'T23:59:59.999').getTime()
        : 9e15; // 远大于任何合理时间戳
      where.completedAt = this._.gte(gte).and(this._.lte(lte));
    }
    return where;
  }

}

module.exports = SessionRepo;
