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

// ─── 全局中间件 ───

const auth = require('./middleware/auth');

// ─── 路由模块（由各 Issue 逐步实现） ───

const taskRoutes = require('./routes/task.routes');
const sessionRoutes = require('./routes/session.routes');
const statsRoutes = require('./routes/stats.routes');
const diaryRoutes = require('./routes/diary.routes');
const userRoutes = require('./routes/user.routes');
const coachRoutes = require('./routes/coach.routes');

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

  // 2. 统一错误处理（兜底，防止 auth / routes 未捕获异常泄漏）
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error('[Unhandled Error]', err);
      ctx.body = { code: -1, message: '服务器内部错误' };
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

  // =========================================
  // 返回路由结果
  // =========================================

  return app.serve();
};
