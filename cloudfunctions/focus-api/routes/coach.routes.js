/**
 * coach.routes.js — AI 教练模块路由
 *
 * 路由: coach/score, coach/tip, coach/weekly-report, coach/correlation, coach/smart-tip
 * 契约: docs/api-contracts.md §7
 */

const CoachService = require('../services/coach.service');
const { succ } = require('../middleware/response');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════════
  //  coach/score
  // ═══════════════════════════════════════════════════════

  app.router('coach/score', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getScore(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════════
  //  coach/tip
  // ═══════════════════════════════════════════════════════

  app.router('coach/tip', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getTip(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════════
  //  🆕 coach/weekly-report
  // ═══════════════════════════════════════════════════════

  app.router('coach/weekly-report', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getWeeklyReport(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════════
  //  🆕 coach/correlation
  // ═══════════════════════════════════════════════════════

  app.router('coach/correlation', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getCorrelation(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════════
  //  🆕 coach/smart-tip
  // ═══════════════════════════════════════════════════════

  app.router('coach/smart-tip', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getSmartTip(ctx.OPENID);
    succ(ctx, result);
  });

};
