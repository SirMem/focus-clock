/**
 * session.api.js —— 专注会话模块前端调用封装
 *
 * 封装 session/complete 和 session/list 接口。
 * 所有调用通过统一的 callAPI 发送到 focus-api 云函数。
 *
 * 用法：
 *   const sessionAPI = require('../../api/session.api');
 *
 *   // 完成一个番茄钟
 *   const res = await sessionAPI.complete('focus', 1500, { taskId: 'abc123' });
 *
 *   // 获取历史记录
 *   const list = await sessionAPI.list({ page: 1, pageSize: 20 });
 *
 * 契约: docs/api-contracts.md §3
 */
const { callAPI } = require('./request');

const sessionAPI = {

  /**
   * 完成一个专注会话
   * @param {'focus'|'shortBreak'|'longBreak'} mode
   * @param {number} duration - 实际专注时长（秒）
   * @param {{ taskId?: string, completedPomodoro?: boolean, idempotencyKey?: string }} [options]
   * @returns {Promise<{code: number, data: object, message: string}>}
   */
  complete(mode, duration, { taskId, completedPomodoro, idempotencyKey } = {}) {
    return callAPI('session/complete', { mode, duration, taskId, completedPomodoro, idempotencyKey });
  },

  /**
   * 获取会话历史列表
   * @param {{ page?: number, pageSize?: number, startDate?: string, endDate?: string }} [params]
   * @returns {Promise<{code: number, data: { sessions: object[], total: number, hasMore: boolean }, message: string}>}
   */
  list(params = {}) {
    return callAPI('session/list', params);
  },

};

module.exports = sessionAPI;
