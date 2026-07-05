/**
 * session.routes.js — 专注会话模块路由
 *
 * 路由: session/complete, session/list
 * 契约: docs/api-contracts.md §3
 *
 * 每路由职责: 参数提取 → 校验 → 调用 Service → 组装响应
 */

const SessionService = require('../services/session.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');
const { MODES, CODES } = require('../config');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  3.1 session/complete
  // ═══════════════════════════════════════════════════

  app.router('session/complete', async (ctx) => {
    const { mode, duration, taskId, completedPomodoro } = ctx.event;

    // ── 参数校验 ──
    if (!validate(ctx, { mode: V.requiredEnum(MODES) })) return;
    if (!validate(ctx, { duration: V.number(1) })) return;
    // taskId 和 completedPomodoro 为可选，无需强制校验

    // ── 调用 Service ──
    const service = SessionService.create();
    const result = await service.completeSession(ctx.OPENID, {
      mode,
      duration,
      taskId,
      completedPomodoro,
    });

    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  3.2 session/list
  // ═══════════════════════════════════════════════════

  app.router('session/list', async (ctx) => {
    const { page, pageSize, startDate, endDate } = ctx.event;

    // ── 可选参数校验 ──
    if (page !== undefined && (!validate(ctx, { page: V.number(1) }))) return;
    if (pageSize !== undefined && (!validate(ctx, { pageSize: V.number(1, 100) }))) return;

    // ── 调用 Service ──
    const service = SessionService.create();
    const result = await service.getSessions(ctx.OPENID, {
      page: page || 1,
      pageSize: pageSize || 20,
      startDate,
      endDate,
    });

    // ── 按契约剥离响应中不应暴露的字段 ──
    // API 契约: sessions 数组中不包含 _openid/createdAt
    result.sessions = result.sessions.map(s => {
      const { _openid, createdAt, ...rest } = s;
      return rest;
    });

    succ(ctx, result);
  });

};
