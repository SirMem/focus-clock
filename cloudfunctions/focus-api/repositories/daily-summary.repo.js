/**
 * daily-summary.repo.js —— daily_summaries 集合数据访问层
 *
 * 日预聚合集合，每天一条记录，写时更新。
 * 避免每次查询今日统计时全量扫描 sessions。
 *
 * upsert 语义：
 *   存在 → 调用方传入的 increments 作为 _.inc() 增量更新
 *   不存在 → 用原始值创建新文档
 *
 * 契约: docs/api-contracts.md §3 · 附录 A daily_summaries
 */

const { getDb } = require('../utils/cloud');

class DailySummaryRepo {

  constructor(db) {
    this.collection = db.collection('daily_summaries');
    this._ = db.command;
  }

  /**
   * 工厂方法
   * @returns {DailySummaryRepo}
   */
  static create() {
    return new DailySummaryRepo(getDb());
  }

  /**
   * 插入或更新当日汇总
   *
   * @param {string} openId
   * @param {string} date - YYYY-MM-DD
   * @param {object} increments - 增量字段（如 { focusMinutes: 25, pomodoroCount: 1 }）
   *   - 存在记录: 字段值通过 _.inc() 增量更新
   *   - 新记录:   字段值作为原始值写入
   * @returns {Promise<object>}
   */
  async upsert(openId, date, increments) {
    const where = { _openid: openId, date };
    const existing = await this.collection.where(where).get();
    const now = Date.now();

    if (existing.data.length > 0) {
      // ── 已有记录：增量更新 ──
      const data = { updatedAt: now };
      for (const [key, value] of Object.entries(increments)) {
        data[key] = this._.inc(value);
      }
      return this.collection.doc(existing.data[0]._id).update({ data });
    }

    // ── 新记录：用原始值创建 ──
    return this.collection.add({
      data: {
        _openid: openId,
        date,
        focusMinutes: 0,
        pomodoroCount: 0,
        completedTasks: 0,
        ...increments,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  /**
   * 查询指定日期的日汇总记录
   *
   * @param {string} openId
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<object|null>} 汇总对象，无记录返回 null
   */
  async findByDate(openId, date) {
    const res = await this.collection.where({ _openid: openId, date }).get();
    return res.data[0] || null;
  }

  /**
   * P2-2: 按日期范围批量查询日汇总记录（替代逐日查询的 N+1 问题）
   *
   * @param {string} openId
   * @param {string} startDate - YYYY-MM-DD 起始日期（含）
   * @param {string} endDate   - YYYY-MM-DD 结束日期（含）
   * @returns {Promise<object[]>} 日期范围内的所有汇总记录
   */
  async findByDateRange(openId, startDate, endDate) {
    const res = await this.collection.where({
      _openid: openId,
      date: this._.gte(startDate).and(this._.lte(endDate)),
    }).get();
    return res.data;
  }

}

module.exports = DailySummaryRepo;
