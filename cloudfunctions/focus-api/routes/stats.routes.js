/**
 * stats.routes.js —— 统计模块路由
 *
 * 路由: stats/today, stats/weekly, stats/monthly, stats/heatmap
 * 契约: docs/dev-specs/03-stats.md
 */

const StatsService = require('../services/stats.service');
const { succ } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  stats/today
  // ═══════════════════════════════════════════════════

  app.router('stats/today', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getTodayStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/today/detail — 今日专注小时分布
  // ═══════════════════════════════════════════════════

  app.router('stats/today/detail', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getTodayDetail(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/weekly
  // ═══════════════════════════════════════════════════

  app.router('stats/weekly', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getWeeklyStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/monthly
  // ═══════════════════════════════════════════════════

  app.router('stats/monthly', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getMonthlyStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/heatmap
  // ═══════════════════════════════════════════════════

  app.router('stats/heatmap', async (ctx) => {
    const { year, month } = ctx.event;
    if (!validate(ctx, { year: V.number(2020, 2030) })) return;
    if (!validate(ctx, { month: V.number(1, 12) })) return;

    const service = StatsService.create();
    const result = await service.getHeatmapData(ctx.OPENID, year, month);
    succ(ctx, result);
  });

};
