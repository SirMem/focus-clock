/**
 * export.api.js —— 数据导出模块前端调用封装
 *
 * 封装 export/stats 和 export/data 接口。
 *
 * 用法：
 *   const exportAPI = require('../../miniprogram/api/export.api');
 *   const stats = await exportAPI.getStats();
 *   const data = await exportAPI.getData({ range: 'all', format: 'json' });
 */
const { callAPI } = require('./request');

const exportAPI = {

  /**
   * 获取数据概览统计（专注/日记/任务记录数）
   * @returns {Promise<{code: number, data: {sessionCount: number, diaryCount: number, taskCount: number}}>}
   */
  getStats() {
    return callAPI('export/stats');
  },

  /**
   * 按范围导出原始数据
   * @param {{ range?: string, format?: string }} params
   *   range: '7d' | '30d' | 'all' (默认 'all')
   *   format: 'json' (P0 只做 JSON)
   * @returns {Promise<{code: number, data: {sessions: Array, diaries: Array, tasks: Array, exportedAt: number, range: string}}>}
   */
  getData(params = {}) {
    return callAPI('export/data', params);
  },

};

module.exports = exportAPI;
