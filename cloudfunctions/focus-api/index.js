/**
 * focus-api —— 主云函数入口
 *
 * 使用 tcb-router 做 Koa 风格路由分发。
 * 全局中间件在这里注册，路由模块在这里挂载。
 *
 * tcb-router 文档: https://www.npmjs.com/package/tcb-router
 */

const TcbRouter = require('tcb-router');
const { cloud, getDb } = require('./utils/cloud');
const { AppError } = require('./utils/app-error');

// ─── 全局中间件 ───

const auth = require('./middleware/auth');

// ─── 路由模块（由各 Issue 逐步实现） ───

const taskRoutes = require('./routes/task.routes');
const sessionRoutes = require('./routes/session.routes');
const statsRoutes = require('./routes/stats.routes');
const diaryRoutes = require('./routes/diary.routes');
const userRoutes = require('./routes/user.routes');
const coachRoutes = require('./routes/coach.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const ratingRoutes = require('./routes/rating.routes');

exports.main = async (event, context) => {
  const app = new TcbRouter({ event, context });

  // =========================================
  // 全局中间件 —— 按注册顺序依次执行
  // =========================================

  // 1. 注入云开发 SDK 上下文
  app.use(async (ctx, next) => {
    ctx.cloud = cloud;
    ctx.db = getDb();
    ctx._ = ctx.db.command;
    ctx.event = ctx.event || event || {};
    ctx.rawEvent = event;
    ctx.rawContext = context;
    await next();
  });

  // 2. 统一错误处理（P3-2: 区分 AppError / 常见业务错误 / 未预期错误）
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        console.warn('[AppError]', { code: err.code, message: err.message });
        ctx.body = { code: err.code, message: err.message };
      } else if (err && err.message === 'USER_NOT_FOUND') {
        ctx.body = { code: 404, message: '用户不存在' };
      } else if (err && err.code === 'RESOURCE_NOT_FOUND') {
        ctx.body = { code: 404, message: '请求的资源不存在' };
      } else {
        // ── 未预期错误 → 返回详细异常信息，便于排查
        const errMsg = err && err.message ? err.message : String(err);
        const errStack = err && err.stack ? err.stack : '';
        console.error('[Unhandled Error]', errMsg, '\n' + errStack);
        ctx.body = {
          code: -1,
          message: '服务器内部错误',
          error: {
            type: (err && err.constructor && err.constructor.name) || 'Unknown',
            message: errMsg,
            // 仅返回 server 侧调用帧，剥离 node_modules
            stack: errStack
              .split('\n')
              .filter(line => line.includes('focus-api') && !line.includes('node_modules'))
              .map(s => s.trim())
              .slice(0, 8),
          },
        };
      }
    }
  });

  // 3. OPENID 鉴权（全局启用，所有路由都需要用户身份）
  app.use(auth);

  // =========================================
  // 路由挂载
  // =========================================

  taskRoutes(app);
  sessionRoutes(app);
  statsRoutes(app);
  diaryRoutes(app);
  userRoutes(app);
  coachRoutes(app);
  feedbackRoutes(app);
  ratingRoutes(app);

  // =========================================
  // 返回路由结果
  // =========================================

  return app.serve();
};
