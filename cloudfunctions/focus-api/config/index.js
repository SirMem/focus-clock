/**
 * 统一配置 —— 状态码、环境常量、默认值
 *
 * 所有模块共享的常量和默认值置于此处。
 * 不要在此文件中引用业务模块。
 */

// ─── 响应状态码 ───

const CODES = {
  SUCCESS: 0,
  ERR_PARAM: 400,
  ERR_UNAUTHORIZED: 401,
  ERR_FORBIDDEN: 403,
  ERR_NOT_FOUND: 404,
  ERR_SERVER: -1,
};

const MESSAGES = {
  [CODES.SUCCESS]: 'ok',
  [CODES.ERR_PARAM]: '参数错误',
  [CODES.ERR_UNAUTHORIZED]: '未登录',
  [CODES.ERR_FORBIDDEN]: '无权限',
  [CODES.ERR_NOT_FOUND]: '资源不存在',
  [CODES.ERR_SERVER]: '服务器内部错误',
};

// ─── 优先级枚举 ───

const PRIORITIES = ['high', 'medium', 'low'];
const PRIORITY_DEFAULT = 'medium';

// ─── 情绪标签枚举 ───

const EMOTION_TAGS = ['开心', '平静', '焦虑', '疲惫', '沮丧', '兴奋', '无聊'];

// ─── 分页默认值 ───

const PAGING = {
  PAGE_DEFAULT: 1,
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
};

// ─── 番茄计时默认值（秒） ───

const DURATIONS = {
  FOCUS: 25 * 60,
  SHORT_BREAK: 5 * 60,
  LONG_BREAK: 15 * 60,
};

const MODES = ['focus', 'shortBreak', 'longBreak'];

module.exports = {
  CODES,
  MESSAGES,
  PRIORITIES,
  PRIORITY_DEFAULT,
  EMOTION_TAGS,
  PAGING,
  DURATIONS,
  MODES,
};
