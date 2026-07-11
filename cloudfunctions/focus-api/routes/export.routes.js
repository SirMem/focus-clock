/**
 * export.routes.js — 数据导出模块路由
 *
 * 路由: export/stats — 数据概览统计
 *       export/data  — 按范围导出原始数据
 */

const { succ } = require('../middleware/response');
const { getDb } = require('../utils/cloud');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════════
  //  export/stats — 数据概览（专注/日记/任务的记录数）
  // ═══════════════════════════════════════════════════════

  app.router('export/stats', async (ctx) => {
    const db = ctx.db;
    const _ = ctx._;
    const openId = ctx.OPENID;

    const [sessionCount, diaryCount, taskCount] = await Promise.all([
      db.collection('sessions').where({ _openid: openId }).count().then(r => r.total),
      db.collection('diaries').where({ _openid: openId }).count().then(r => r.total),
      db.collection('tasks').where({ _openid: openId }).count().then(r => r.total),
    ]);

    succ(ctx, { sessionCount, diaryCount, taskCount });
  });

  // ═══════════════════════════════════════════════════════
  //  export/data — 按范围导出数据（P0 只做 JSON）
  // ═══════════════════════════════════════════════════════

  app.router('export/data', async (ctx) => {
    const db = ctx.db;
    const _ = ctx._;
    const openId = ctx.OPENID;

    const { range = 'all', format = 'json' } = ctx.event || {};

    // 构建时间范围查询条件
    let rangeFilter = {};
    if (range !== 'all') {
      let startTs;
      const now = Date.now();
      if (range === '7d') {
        startTs = now - 7 * 24 * 60 * 60 * 1000;
      } else if (range === '30d') {
        startTs = now - 30 * 24 * 60 * 60 * 1000;
      }
      if (startTs) {
        rangeFilter = { completedAt: _.gte(startTs).and(_.lte(now)) };
      }
    }

    // 并发查询三个集合
    const whereBase = { _openid: openId };

    const [sessions, diaries, tasks] = await Promise.all([
      db.collection('sessions').where({ ...whereBase, ...rangeFilter }).orderBy('completedAt', 'asc').get().then(r => r.data),
      db.collection('diaries').where(whereBase).get().then(r => r.data),
      db.collection('tasks').where(whereBase).get().then(r => r.data),
    ]);

    succ(ctx, { sessions, diaries, tasks, exportedAt: Date.now(), range });
  });

};
