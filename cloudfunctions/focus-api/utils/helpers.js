/**
 * helpers —— 纯工具函数集合
 *
 * 所有函数不依赖外部状态（纯函数），可被任意模块引用。
 */

/**
 * 将秒数格式化为 "Xh Ym"
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * 获取当日 YYYY-MM-DD 字符串
 * @param {Date|number} [date] 可选，默认当前时间
 * @returns {string}
 */
function getDateStr(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 获取本周一的 YYYY-MM-DD 字符串
 * @param {Date|number} [date] 可选，默认当前时间
 * @returns {string}
 */
function getWeekStart(date) {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay(); // 0=周日, 1=周一
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getDateStr(d);
}

/**
 * 获取本月 YYYY-MM 字符串
 * @param {Date|number} [date] 可选，默认当前时间
 * @returns {string}
 */
function getMonthStr(date) {
  const d = date ? new Date(date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 获取当月的天数
 * @param {number} year
 * @param {number} month (1-12)
 * @returns {number}
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 安全地截断字符串
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 100) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

module.exports = {
  formatDuration,
  getDateStr,
  getWeekStart,
  getMonthStr,
  getDaysInMonth,
  truncate,
};
