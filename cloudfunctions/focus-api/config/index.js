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

// ─── Task v2 规划字段 ───

const TASK_REPEAT_TYPES = ['none', 'daily', 'weekly', 'weekdays'];
const TASK_REPEAT_DEFAULT = {
  enabled: false,
  type: 'none',
  interval: 1,
};
const TASK_LIMITS = {
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 500,
  ESTIMATED_POMODOROS_MIN: 1,
  ESTIMATED_POMODOROS_MAX: 12,
  SUBTASKS_MAX: 20,
  REPEAT_INTERVAL_MIN: 1,
  REPEAT_INTERVAL_MAX: 365,
};

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
  TASK_REPEAT_TYPES,
  TASK_REPEAT_DEFAULT,
  TASK_LIMITS,
  EMOTION_TAGS,
  PAGING,
  DURATIONS,
  MODES,
};
