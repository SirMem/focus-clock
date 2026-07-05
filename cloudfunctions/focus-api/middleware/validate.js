/**
 * validate 中间件 —— 参数校验工具（非中间件，作为工具函数导出）
 *
 * 不注册为全局中间件，而是在路由处理函数中按需调用。
 * 这样每个接口可以定义自己的校验规则。
 *
 * 用法：
 *   const { validate, V } = require('../middleware/validate');
 *
 *   app.router('task/create', async (ctx) => {
 *     const { title, priority } = ctx.event;
 *     if (!validate(ctx, { title: V.required(1, 100) })) return;
 *     // ... 继续处理
 *   });
 */

const { CODES } = require('../config');

// ─── 校验规则构造器 ───

const V = {
  /**
   * 必填字符串
   * @param {number} minLen 最小长度（默认 1）
   * @param {number} maxLen 最大长度（默认无上限）
   */
  required(minLen = 1, maxLen = Infinity) {
    return { required: true, type: 'string', minLen, maxLen };
  },

  /** 可选字符串 */
  optionalString() {
    return { required: false, type: 'string' };
  },

  /** 必填数字，且在范围内 */
  number(min, max) {
    return { required: true, type: 'number', min, max };
  },

  /** 可选数字 */
  optionalNumber(min, max) {
    return { required: false, type: 'number', min, max };
  },

  /** 布尔值 */
  boolean() {
    return { required: false, type: 'boolean' };
  },

  /** 枚举值 */
  enum(values) {
    return { required: false, type: 'enum', values };
  },

  /** 必填枚举 */
  requiredEnum(values) {
    return { required: true, type: 'enum', values };
  },

  /** 字符串数组 */
  stringArray(maxLength = 5) {
    return { required: false, type: 'string[]', maxLength };
  },
};

/**
 * 校验参数，失败时自动设置 ctx.body 并返回 false
 * @param {object} ctx - tcb-router 上下文
 * @param {object} rules - 校验规则 { 字段名: 规则对象 }
 * @returns {boolean} 是否通过校验
 */
function validate(ctx, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const value = ctx.event[field];

    // 1. 检查必填
    if (rule.required && (value === undefined || value === null || value === '')) {
      ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」不能为空` };
      return false;
    }

    // 如果值为空且非必填，跳过后续校验
    if (value === undefined || value === null || value === '') continue;

    // 2. 类型检查
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」必须是字符串` };
          return false;
        }
        if (value.length < rule.minLen) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」长度不能小于 ${rule.minLen}` };
          return false;
        }
        if (value.length > rule.maxLen) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」长度不能超过 ${rule.maxLen}` };
          return false;
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」必须是数字` };
          return false;
        }
        if (rule.min !== undefined && value < rule.min) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」不能小于 ${rule.min}` };
          return false;
        }
        if (rule.max !== undefined && value > rule.max) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」不能大于 ${rule.max}` };
          return false;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」必须是布尔值` };
          return false;
        }
        break;

      case 'enum':
        if (!rule.values.includes(value)) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」值不在允许范围内: ${rule.values.join(', ')}` };
          return false;
        }
        break;

      case 'string[]':
        if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」必须是字符串数组` };
          return false;
        }
        if (value.length > rule.maxLength) {
          ctx.body = { code: CODES.ERR_PARAM, message: `参数「${field}」长度不能超过 ${rule.maxLength}` };
          return false;
        }
        break;

      default:
        break;
    }
  }

  return true;
}

module.exports = { validate, V };
