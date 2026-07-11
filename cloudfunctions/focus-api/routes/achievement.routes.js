/**
 * achievement.routes.js — 成就勋章模块路由
 *
 * 路由: achievement/list
 */

const AchievementService = require('../services/achievement.service');
const { succ } = require('../middleware/response');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════════
  //  achievement/list — 获取全部成就判定
  // ═══════════════════════════════════════════════════════

  app.router('achievement/list', async (ctx) => {
    const service = AchievementService.create();
    const result = await service.getAchievements(ctx.OPENID);
    succ(ctx, result);
  });

};
