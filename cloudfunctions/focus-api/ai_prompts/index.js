/**
 * ai_prompts/index.js — Prompt 模板管理
 *
 * 从云数据库 ai_prompts 集合读取 prompt 模板（支持热更新）。
 * DB 读取失败时降级到本地硬编码的默认模板。
 *
 * 数据库集合: ai_prompts
 * 查询条件: { type, isActive: true }，按 version desc 取第一条
 */

const { getDb } = require('../utils/cloud');

// ── 本地默认模板（各 prompt 模块 export 的 DEFAULT_TEMPLATE）──

const WEEKLY_DEFAULT = require('../ai/prompts/weekly-report').DEFAULT_TEMPLATE;
const CORRELATION_DEFAULT = require('../ai/prompts/correlation').DEFAULT_TEMPLATE;

const LOCAL_DEFAULTS = {
  weekly_report: WEEKLY_DEFAULT,
  correlation: CORRELATION_DEFAULT,
};

// ── 公开 API ────────────────────────────────────────────────

/**
 * 加载 prompt 模板（DB 优先，失败降级到本地默认值）
 *
 * @param {'weekly_report' | 'correlation'} type
 * @returns {Promise<{systemPrompt: string, userPromptTemplate: string, model?: string, temperature?: number, maxTokens?: number, source: 'db' | 'local', version: number}>}
 */
async function loadPromptTemplate(type) {
  try {
    const db = getDb();
    const res = await db.collection('ai_prompts')
      .where({ type, isActive: true })
      .orderBy('version', 'desc')
      .limit(1)
      .get();

    if (res.data && res.data.length > 0) {
      const doc = res.data[0];
      return {
        systemPrompt: doc.systemPrompt || LOCAL_DEFAULTS[type]?.systemPrompt || '',
        userPromptTemplate: doc.userPromptTemplate || '',
        model: doc.model || undefined,
        temperature: typeof doc.temperature === 'number' ? doc.temperature : undefined,
        maxTokens: typeof doc.maxTokens === 'number' ? doc.maxTokens : undefined,
        source: 'db',
        version: doc.version || 1,
      };
    }
  } catch (err) {
    console.warn(`[ai_prompts] DB 读取失败 (type=${type})，降级到本地默认:`, err.message);
  }

  // ── 降级：本地默认 ──
  const local = LOCAL_DEFAULTS[type];
  if (!local) {
    throw new Error(`Unknown prompt type: ${type}`);
  }

  return {
    systemPrompt: local.systemPrompt,
    userPromptTemplate: local.userPromptTemplate,
    source: 'local',
    version: 0,
  };
}

module.exports = { loadPromptTemplate };
