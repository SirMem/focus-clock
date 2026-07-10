/**
 * ai/client.js — OpenAI-compatible Chat Completions HTTP 客户端
 *
 * 封装对 DeepSeek（或任意 OpenAI-compatible）API 的 POST /v1/chat/completions 调用。
 * 使用 Node.js 内置 https/http 模块，零外部依赖。
 *
 * 错误分类：
 *   AIClientError(code='NO_API_KEY')   — API Key 未配置
 *   AIClientError(code='AUTH_ERROR')   — 401/403 鉴权失败
 *   AIClientError(code='BAD_REQUEST')  — 400 参数错误
 *   AIClientError(code='API_ERROR')    — 其他非 200 响应
 *   Error (network)                     — 网络不通 / DNS 失败
 *   Error (timeout)                     — 请求超时
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const config = require('./config');

// ── 错误类型 ────────────────────────────────────────────────

class AIClientError extends Error {
  /**
   * @param {string} message
   * @param {'NO_API_KEY'|'AUTH_ERROR'|'BAD_REQUEST'|'API_ERROR'} code
   */
  constructor(message, code) {
    super(message);
    this.name = 'AIClientError';
    this.code = code;
  }
}

// ── HTTP 工具 ───────────────────────────────────────────────

/**
 * 发送 JSON POST 请求
 * @param {string} url
 * @param {object} body - JSON-serializable 请求体
 * @param {{ timeout: number, headers: object }} options
 * @returns {Promise<{status: number, body: string}>}
 */
function postJSON(url, body, { timeout = 15000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`AI API request timeout after ${timeout}ms`));
    });
    req.on('error', (err) => {
      reject(new Error(`AI API network error: ${err.message}`));
    });

    req.write(bodyStr);
    req.end();
  });
}

// ── 公开 API ────────────────────────────────────────────────

/**
 * 发送 Chat Completion 请求
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {string} [options.host]        - 覆盖默认 host
 * @param {string} [options.apiKey]      - 覆盖默认 apiKey
 * @param {string} [options.model]       - 覆盖默认 model
 * @param {number} [options.temperature] - 覆盖默认 temperature
 * @param {number} [options.max_tokens]  - 覆盖默认 max_tokens
 * @param {number} [options.top_p]       - 覆盖默认 top_p
 * @param {number} [options.timeout]     - 覆盖默认 timeout
 * @returns {Promise<{content: string, usage: object, model: string}>}
 */
async function chat(messages, options = {}) {
  const host = options.host || config.host;
  const apiKey = options.apiKey || config.apiKey;
  const model = options.model || config.defaults.model;
  const temperature = options.temperature ?? config.defaults.temperature;
  const max_tokens = options.max_tokens || config.defaults.max_tokens;
  const top_p = options.top_p ?? config.defaults.top_p;
  const timeout = options.timeout || config.timeout;
  const maxRetries = config.retry || 0;

  if (!apiKey) {
    throw new AIClientError(
      'DEEPSEEK_API_KEY 未配置。请在云函数环境变量中设置 DEEPSEEK_API_KEY。',
      'NO_API_KEY',
    );
  }

  const body = { model, messages, temperature, max_tokens, top_p };

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await postJSON(`${host}/v1/chat/completions`, body, {
        timeout,
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (res.status === 200) {
        const data = JSON.parse(res.body);
        const choice = data.choices && data.choices[0];
        if (!choice || !choice.message) {
          throw new AIClientError('AI API returned empty response', 'API_ERROR');
        }
        return {
          content: choice.message.content || '',
          usage: data.usage || {},
          model: data.model || model,
        };
      }

      // ── 不可重试的错误 ──
      if (res.status === 401 || res.status === 403) {
        throw new AIClientError(`AI API 鉴权失败 (${res.status})`, 'AUTH_ERROR');
      }
      if (res.status === 400) {
        throw new AIClientError(`AI API 参数错误: ${res.body}`, 'BAD_REQUEST');
      }
      if (res.status === 429) {
        throw new AIClientError('AI API 频率限制 (429)', 'API_ERROR');
      }

      // ── 可重试的错误（5xx）──
      lastError = new AIClientError(`AI API server error (${res.status})`, 'API_ERROR');
    } catch (err) {
      if (err instanceof AIClientError) {
        // 不可重试的 error 直接抛
        if (err.code === 'AUTH_ERROR' || err.code === 'BAD_REQUEST' || err.code === 'NO_API_KEY') {
          throw err;
        }
      }
      lastError = err;
    }
  }

  throw lastError;
}

module.exports = { chat, AIClientError };
