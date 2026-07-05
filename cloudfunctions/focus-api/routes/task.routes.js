/**
 * task.routes.js — 待办模块路由
 *
 * 路由: task/create, task/list, task/update, task/delete
 * 契约: docs/api-contracts.md §2
 *
 * 参数校验使用 validate + V（middleware/validate.js）
 * 响应使用 succ / fail（middleware/response.js）
 */

const TaskService = require('../services/task.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');
const { PRIORITIES } = require('../config');

module.exports = (app) => {
  // ─── task/create ───────────────────────────────────────

  app.router('task/create', async (ctx) => {
    const { title, priority, estimatedPomodoros } = ctx.event;

    // 校验：title 必填 1-100 字符
    if (!validate(ctx, { title: V.required(1, 100) })) return;

    // 校验：priority 如果传了，必须是合法枚举值
    if (priority !== undefined && !PRIORITIES.includes(priority)) {
      fail(ctx, 400, `priority 必须在 [${PRIORITIES.join(', ')}] 中`);
      return;
    }

    // 校验：estimatedPomodoros 如果传了，必须是 1-99
    if (estimatedPomodoros !== undefined) {
      if (typeof estimatedPomodoros !== 'number' || estimatedPomodoros < 1 || estimatedPomodoros > 99) {
        fail(ctx, 400, 'estimatedPomodoros 必须是 1-99 之间的数字');
        return;
      }
    }

    const service = TaskService.create();
    const result = await service.createTask(ctx.OPENID, { title, priority, estimatedPomodoros });
    succ(ctx, result);
  });

  // ─── task/list ─────────────────────────────────────────

  app.router('task/list', async (ctx) => {
    const { filter, page, pageSize } = ctx.event;

    const service = TaskService.create();
    const result = await service.getTasks(ctx.OPENID, { filter, page, pageSize });
    succ(ctx, result);
  });

  // ─── task/update ───────────────────────────────────────

  app.router('task/update', async (ctx) => {
    const { id, data } = ctx.event;

    // 校验：id 必填
    if (!validate(ctx, { id: V.required() })) return;

    // 校验：data 必须是对象
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      fail(ctx, 400, '参数「data」必须是对象');
      return;
    }

    const service = TaskService.create();
    const result = await service.updateTask(ctx.OPENID, id, data);

    if (result === null) {
      fail(ctx, 404, '任务不存在');
      return;
    }
    if (result === false) {
      fail(ctx, 403, '无权限');
      return;
    }

    succ(ctx, result);
  });

  // ─── task/delete ───────────────────────────────────────

  app.router('task/delete', async (ctx) => {
    const { id } = ctx.event;

    // 校验：id 必填
    if (!validate(ctx, { id: V.required() })) return;

    const service = TaskService.create();
    const result = await service.deleteTask(ctx.OPENID, id);

    if (result === null) {
      fail(ctx, 404, '任务不存在');
      return;
    }
    if (result === false) {
      fail(ctx, 403, '无权限');
      return;
    }

    succ(ctx, result);
  });
};
