/**
 * feedback.routes.js — 意见反馈
 *
 * 路由: feedback/submit
 * 写入集合: feedbacks { _openid, content, createdAt }
 */

const { succ, fail } = require('../middleware/response');

module.exports = (app) => {

  app.router('feedback/submit', async (ctx) => {
    const { content } = ctx.event || {};

    if (!content || typeof content !== 'string') {
      fail(ctx, 400, '反馈内容不能为空');
      return;
    }

    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      fail(ctx, 400, '反馈内容长度必须在 1-500 字符之间');
      return;
    }

    try {
      const res = await ctx.db.collection('feedbacks').add({
        data: {
          _openid: ctx.OPENID,
          content: trimmed,
          createdAt: Date.now(),
        },
      });

      succ(ctx, { _id: res.id });
    } catch (err) {
      console.error('[feedback/submit] error:', err);
      fail(ctx, 500, '反馈提交失败，请稍后重试');
    }
  });
};
