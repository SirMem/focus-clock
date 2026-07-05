/**
 * response 工具 —— 统一响应格式（非中间件，作为工具函数导出）
 *
 * 提供 succ(ctx, data) 和 fail(ctx, code, msg) 两个快捷函数。
 * 路由处理函数中直接使用，确保所有接口返回格式一致。
 *
 * 用法：
 *   const { succ, fail } = require('../middleware/response');
 *   succ(ctx, result);        // → { code: 0, data: result, message: 'ok' }
 *   fail(ctx, 400, '标题不能为空');  // → { code: 400, message: '标题不能为空' }
 */

const { CODES, MESSAGES } = require('../config');

function succ(ctx, data) {
  ctx.body = {
    code: CODES.SUCCESS,
    data,
    message: MESSAGES[CODES.SUCCESS],
  };
}

function fail(ctx, code, message) {
  ctx.body = {
    code,
    message: message || MESSAGES[code] || '未知错误',
  };
}

module.exports = { succ, fail };
