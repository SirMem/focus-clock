/**
 * coach.routes.js —— AI 教练模块路由
 *
 * 路由: coach/score, coach/tip
 * 契约: docs/api-contracts.md §7
 */

const CoachService = require('../services/coach.service');
const { succ } = require('../middleware/response');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  coach/score
  // ═══════════════════════════════════════════════════

  app.router('coach/score', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getScore(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  coach/tip
  // ═══════════════════════════════════════════════════

  app.router('coach/tip', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getTip(ctx.OPENID);
    succ(ctx, result);
  });

};
