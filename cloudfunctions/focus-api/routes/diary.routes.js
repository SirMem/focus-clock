/**
 * diary.routes.js — 日记模块路由
 *
 * 路由: diary/create, diary/list, diary/update, diary/delete
 * 契约: docs/api-contracts.md §5
 */

const DiaryService = require('../services/diary.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {
  /**
   * diary/create — 创建日记
   * 请求: { content, emotionTags?, tasks? }
   * 响应: { code: 0, data: { _id, _openid, content, emotionTags, tasks, createdAt, updatedAt } }
   */
  app.router('diary/create', async (ctx) => {
    const { content, emotionTags, tasks } = ctx.event;
    if (!validate(ctx, { content: V.required(1, 2000) })) return;
    if (emotionTags !== undefined) {
      if (!Array.isArray(emotionTags) || !emotionTags.every(v => typeof v === 'string')) {
        fail(ctx, 400, '参数「emotionTags」必须是字符串数组');
        return;
      }
      if (emotionTags.length > 5) {
        fail(ctx, 400, '参数「emotionTags」不能超过 5 个');
        return;
      }
    }

    const service = DiaryService.create();
    const result = await service.createDiary(ctx.OPENID, { content, emotionTags, tasks });
    succ(ctx, result);
  });

  /**
   * diary/list — 获取日记列表
   * 请求: { page?, pageSize?, date?, emotionTag? }
   * 响应: { code: 0, data: { diaries: [...], total, hasMore } }
   */
  app.router('diary/list', async (ctx) => {
    const { page, pageSize, date, emotionTag } = ctx.event;

    const service = DiaryService.create();
    const result = await service.getDiaries(ctx.OPENID, { page, pageSize, date, emotionTag });
    succ(ctx, result);
  });

  /**
   * diary/update — 更新日记
   * 请求: { id, data: { content?, emotionTags?, tasks? } }
   * 响应: { code: 0, data: { updated: number } }
   */
  app.router('diary/update', async (ctx) => {
    const { id, data } = ctx.event;
    if (!validate(ctx, { id: V.required() })) return;

    if (!data || typeof data !== 'object') {
      fail(ctx, 400, '参数「data」不能为空');
      return;
    }

    const service = DiaryService.create();
    const result = await service.updateDiary(ctx.OPENID, id, data);
    if (result === null) {
      fail(ctx, 404, '日记不存在');
      return;
    }
    if (result === false) {
      fail(ctx, 403, '无权限');
      return;
    }
    succ(ctx, result);
  });

  /**
   * diary/delete — 删除日记
   * 请求: { id }
   * 响应: { code: 0, data: { deleted: number } }
   */
  app.router('diary/delete', async (ctx) => {
    const { id } = ctx.event;
    if (!validate(ctx, { id: V.required() })) return;

    const service = DiaryService.create();
    const result = await service.deleteDiary(ctx.OPENID, id);
    if (result === null) {
      fail(ctx, 404, '日记不存在');
      return;
    }
    if (result === false) {
      fail(ctx, 403, '无权限');
      return;
    }
    succ(ctx, result);
  });
};
