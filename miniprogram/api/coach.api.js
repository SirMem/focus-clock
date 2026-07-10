/**
 * coach.api.js —— AI 教练模块前端调用封装
 *
 * 封装 coach/score, coach/tip, coach/weekly-report, coach/correlation, coach/smart-tip 接口。
 * 所有调用通过统一的 callAPI 发送到 focus-api 云函数。
 *
 * 用法：
 *   const coachAPI = require('../../miniprogram/api/coach.api');
 *
 *   // 规则引擎
 *   const score = await coachAPI.score();
 *   const tip = await coachAPI.tip();
 *
 *   // AI 增强
 *   const report = await coachAPI.weeklyReport();
 *   const correlation = await coachAPI.correlation();
 *   const smartTip = await coachAPI.smartTip();
 *
 * 契约: docs/api-contracts.md §7
 */
const { callAPI } = require('./request');

const coachAPI = {

  /**
   * 获取综合评分（规则引擎）
   * @returns {Promise<{code: number, data: {score: number, level: string, insights: Array, updatedAt: number}}>}
   */
  score() {
    return callAPI('coach/score');
  },

  /**
   * 获取今日建议（规则引擎）
   * @returns {Promise<{code: number, data: {tip: string, context: object}}>}
   */
  tip() {
    return callAPI('coach/tip');
  },

  /**
   * AI 周报（🆕 LLM 生成，失败时降级到规则引擎）
   * @returns {Promise<{code: number, data: {report: string, highlights: Array, suggestion: string, emotionInsight: string|null, weekSummary: object, generatedBy: string, generatedAt: number}}>}
   */
  weeklyReport() {
    return callAPI('coach/weekly-report');
  },

  /**
   * AI 关联分析（🆕 P1，情绪-专注相关性）
   * @returns {Promise<{code: number, data: {correlations: Array, insight: string, disclaimer: string, generatedBy: string, generatedAt: number, _missing: Array}}>}
   */
  correlation() {
    return callAPI('coach/correlation');
  },

  /**
   * AI 智能建议（🆕 LLM 生成，失败时降级到规则引擎）
   * @returns {Promise<{code: number, data: {tip: string, generatedBy: 'ai'|'rule'|'fallback'}}>}
   */
  smartTip() {
    return callAPI('coach/smart-tip');
  },

};

module.exports = coachAPI;
