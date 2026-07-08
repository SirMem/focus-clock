/**
 * utils/app-error.js —— 业务错误类
 *
 * 用于在 Service 层抛出带业务语义的错误，
 * 全局错误处理中间件根据错误类型返回对应的 HTTP 状态码和错误信息。
 *
 * 参考: docs/known-issues.md §P3-2
 *
 * 用法:
 *   const { AppError } = require('../utils/app-error');
 *   throw new AppError(404, '用户不存在');
 *   throw new AppError(400, '昵称不能超过 20 个字符');
 */

class AppError extends Error {
  /**
   * @param {number} code      - 业务错误码（如 400, 401, 404）
   * @param {string} message   - 用户可读的错误信息
   * @param {number} [httpStatus] - HTTP 状态码（默认同 code）
   */
  constructor(code, message, httpStatus) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus || code;
  }
}

module.exports = { AppError };
