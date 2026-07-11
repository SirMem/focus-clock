/**
 * rating.routes.js — 应用评分
 *
 * 路由: rating/submit
 * 写入集合: ratings { _openid, score, createdAt }
 */

const { succ, fail } = require('../middleware/response');

module.exports = (app) => {

  app.router('rating/submit', async (ctx) => {
    const { score } = ctx.event || {};

    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
      fail(ctx, 400, '评分必须在 1-5 之间');
      return;
    }

    try {
      const res = await ctx.db.collection('ratings').add({
        data: {
          _openid: ctx.OPENID,
          score,
          createdAt: Date.now(),
        },
      });

      succ(ctx, { _id: res.id });
    } catch (err) {
      console.error('[rating/submit] error:', err);
      fail(ctx, 500, '评分提交失败，请稍后重试');
    }
  });
};
