/**
 * ai/config.js — AI 调用配置中心
 *
 * 所有可配置的 AI 参数集中于此，支持任意 OpenAI-compatible API。
 * apiKey 从云函数环境变量 DEEPSEEK_API_KEY 读取，不在代码中硬编码。
 *
 * 部署步骤：
 *   微信云开发控制台 → 云函数 → focus-api → 环境变量
 *   添加 DEEPSEEK_API_KEY = sk-xxx
 */

module.exports = {
  /** API 服务地址（可替换为任意 OpenAI-compatible 服务） */
  host: 'https://opencode.ai/zen/go',

  /** API Key（从环境变量读取，不硬编码） */
  apiKey: process.env.DEEPSEEK_API_KEY || '',

  /** 默认调用参数 */
  defaults: {
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 0.9,
  },

  /** 请求超时（毫秒） */
  timeout: 15000,

  /** 失败重试次数 */
  retry: 1,
};
