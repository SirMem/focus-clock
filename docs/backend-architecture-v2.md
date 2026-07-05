# 后端架构设计 v2 — tcb-router + Clean Layered Architecture

> 状态: ✅ 已定稿 · 最后更新: 2026-07-04
> 对应议题: [后端架构讨论] 议题一·云函数管理方式与目录设计

---

## 1. 架构决策记录

### 1.1 决策摘要

| 维度 | 选择 | 理由 |
|------|------|------|
| 云函数组织方式 | **单云函数 + tcb-router** | 3-4 人团队规模，~15 个接口，共享代码自然，冷启动成本低 |
| 分层模式 | **Middleware → Routes → Services → Repositories** | Clean Architecture 的轻量落地，不引入运行时 DI 容器 |
| 依赖注入 | **手动工厂函数** | 云函数 FaaS 无 DI 容器生命周期，工厂函数足够且无额外依赖 |
| 前端调用封装 | `api/*.api.js` 统一封装 | 前端不直接写 `wx.cloud.callFunction` 裸调用 |

### 1.2 为什么不选其他方案

| 方案 | 放弃理由 |
|------|---------|
| 多云函数拆分（每模块一个函数） | 共享代码需 npm 包或 copy，增加管理成本；冷启动惩罚 ×N；当前项目规模不需要 |
| 完全不分层（所有逻辑在 index.js） | 不可维护，无法并行开发，无法单测 |
| 引入 DI 容器（如 inversify） | 云函数每次调用都重新构建容器，带来不必要的运行时开销 |

---

## 2. 整体目录结构

```
cloudfunctions/
└── focus-api/                          # ★ 唯一的主云函数
    ├── index.js                        # TcbRouter 入口 + 全局中间件注册
    ├── package.json                    # tcb-router + @cloudbase/node-sdk
    │
    ├── config/
    │   └── index.js                    # 统一配置（状态码、环境常量）
    │
    ├── middleware/
    │   ├── auth.js                     # OPENID 鉴权
    │   ├── validate.js                 # 参数校验工具
    │   └── response.js                 # 统一响应格式 { code, data, message }
    │
    ├── routes/                         # ★ Controller 层（只做分发）
    │   ├── index.js                    #    统一注册所有路由模块
    │   ├── task.routes.js              #    待办 CRUD
    │   ├── diary.routes.js             #    日记 CRUD
    │   ├── stats.routes.js             #    统计查询
    │   ├── session.routes.js           #    专注会话完成
    │   ├── user.routes.js              #    用户登录 & 设置
    │   └── coach.routes.js             #    AI 教练
    │
    ├── services/                       # ★ Service 层（纯业务逻辑）
    │   ├── task.service.js
    │   ├── diary.service.js
    │   ├── stats.service.js
    │   ├── session.service.js
    │   └── coach.service.js
    │
    ├── repositories/                   # ★ Repository 层（数据访问）
    │   ├── task.repo.js
    │   ├── diary.repo.js
    │   ├── session.repo.js
    │   ├── daily-summary.repo.js
    │   └── user.repo.js
    │
    └── utils/
        └── helpers.js                  # 纯工具函数（时间格式化、随机数等）

miniprogram/
├── pages/...                           # 页面
├── components/...                      # 组件
└── api/                                # ★ 新增：前端 API 调用层
    ├── request.js                      #    封装 wx.cloud.callFunction
    ├── task.api.js                     #    待办模块接口
    ├── diary.api.js                    #    日记模块接口
    ├── stats.api.js                    #    统计模块接口
    ├── session.api.js                  #    专注模块接口
    └── user.api.js                     #    用户模块接口
```

---

## 3. 各层职责与代码规范

### 3.1 入口层 `index.js`

职责：初始化 TcbRouter、注册全局中间件、挂载路由模块。

```javascript
const TcbRouter = require('tcb-router');
const cloud = require('@cloudbase/node-sdk');

// 导入路由模块
const taskRoutes = require('./routes/task.routes');
const diaryRoutes = require('./routes/diary.routes');
// ...

exports.main = async (event, context) => {
  const app = new TcbRouter({ event, context });

  // 全局中间件 —— 初始化云开发 SDK
  app.use(async (ctx, next) => {
    const c = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    ctx.cloud = c;
    ctx.db = c.database();
    ctx._ = ctx.db.command;
    await next();
  });

  // 全局中间件 —— 统一错误处理
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      console.error('[Unhandled Error]', err);
      ctx.body = { code: -1, message: '服务器内部错误' };
    }
  });

  // 路由注册
  taskRoutes(app);
  diaryRoutes(app);
  // ...

  return app.serve();
};
```

### 3.2 路由层 `routes/*.routes.js`（Controller）

职责：**只做四件事**，不做任何业务逻辑：

1. 从 `ctx.event` 提取参数
2. 调用中间件做鉴权/校验
3. 调用 Service 层
4. 组装 `ctx.body` 返回

```javascript
// routes/task.routes.js
const TaskService = require('../services/task.service');

module.exports = (app) => {

  app.router('task/create', async (ctx) => {
    const { title, priority } = ctx.event;
    const { OPENID } = ctx.event.userInfo;

    // 参数校验（在路由层做）
    if (!title || !title.trim()) {
      ctx.body = { code: 400, message: '任务标题不能为空' };
      return;
    }

    // 调用 Service
    const service = TaskService.create();
    const result = await service.createTask(OPENID, { title, priority });

    ctx.body = { code: 0, data: result };
  });

  app.router('task/list', async (ctx) => {
    const { filter, page = 1, pageSize = 20 } = ctx.event;
    const { OPENID } = ctx.event.userInfo;

    const service = TaskService.create();
    const result = await service.getTasks(OPENID, { filter, page, pageSize });

    ctx.body = { code: 0, data: result };
  });

};
```

### 3.3 服务层 `services/*.service.js`（Service）

职责：**纯业务逻辑**，不直接操作数据库。

- 所有数据库操作委托给 Repository
- 可被单元测试（通过 mock Repository）
- 不引用 `ctx`、`event` 等云函数上下文

```javascript
// services/task.service.js
const TaskRepo = require('../repositories/task.repo');

class TaskService {

  constructor(taskRepo) {
    this.taskRepo = taskRepo;        // 依赖注入点
  }

  static create() {
    return new TaskService(TaskRepo.create());
  }

  async createTask(openId, { title, priority = 'mid' }) {
    const task = {
      _openid: openId,
      title: title.trim(),
      priority,
      isDone: false,
      completedPomodoros: 0,
      sortOrder: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return this.taskRepo.insert(task);
  }

  async getTasks(openId, { filter = {}, page, pageSize }) {
    const where = { _openid: openId };
    if (filter.isDone !== undefined) where.isDone = filter.isDone;
    if (filter.priority) where.priority = filter.priority;

    const [tasks, total] = await Promise.all([
      this.taskRepo.findAll(where, { page, pageSize }),
      this.taskRepo.count(where),
    ]);

    return { tasks, total, hasMore: page * pageSize < total };
  }

}
```

### 3.4 仓储层 `repositories/*.repo.js`（Repository）

职责：**封装所有数据库操作**，对外暴露纯数据方法。

- 不包含业务逻辑
- 方法名用数据库操作术语：`insert` / `findAll` / `findById` / `update` / `delete` / `count`
- 返回原始数据库结果

```javascript
// repositories/task.repo.js
class TaskRepo {

  constructor(db) {
    this.collection = db.collection('tasks');
  }

  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new TaskRepo(app.database());
  }

  async insert(data) {
    const res = await this.collection.add({ data });
    return { _id: res.id, ...data };
  }

  async findAll(where, { page = 1, pageSize = 20 } = {}) {
    const res = await this.collection
      .where(where)
      .orderBy('sortOrder', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    return res.data;
  }

  async count(where) {
    const res = await this.collection.where(where).count();
    return res.total;
  }

  async updateById(id, data) {
    return this.collection.doc(id).update({
      data: { ...data, updatedAt: Date.now() },
    });
  }

  async deleteById(id) {
    return this.collection.doc(id).remove();
  }

}

module.exports = TaskRepo;
```

### 3.5 中间件层 `middleware/*.js`

```javascript
// middleware/auth.js — OPENID 鉴权中间件
module.exports = async (ctx, next) => {
  const { OPENID } = ctx.event.userInfo || {};
  if (!OPENID) {
    ctx.body = { code: 401, message: '未登录' };
    return;  // 不调用 next()，短路
  }
  ctx.OPENID = OPENID;
  await next();
};
```

在 `index.js` 中使用：

```javascript
const auth = require('./middleware/auth');

// 只对 user/info 路由应用鉴权
app.use('user/info', auth);
// 或对所有路由应用
// app.use(auth);
```

---

## 4. 依赖注入模式（重要）

因为云函数没有 DI 容器的生命周期，我们采用**手动工厂函数 + 构造函数注入**：

```
┌─ Service 层 ──────┐    ┌─ Repository 层 ────┐
│                    │    │                    │
│  TaskService       │───>│  TaskRepo           │
│  constructor(repo) │    │  static create()    │
│  static create()   │    │  = new TaskRepo(db) │
│                    │    │                    │
└────────────────────┘    └────────────────────┘
```

**规则：**
- 每个 `Service` 和 `Repository` 都有一个 `static create()` 工厂方法
- `Service` 的 `create()` 内部调用 `Repo.create()`，形成依赖链
- 单测时绕过 `create()`，直接 `new Service(mockRepo)` 注入 mock

```javascript
// 单元测试示例（Jest）
const TaskService = require('../services/task.service');

test('createTask should insert task via repo', async () => {
  const mockRepo = {
    insert: jest.fn().mockResolvedValue({ _id: '123', title: 'test' }),
  };
  const service = new TaskService(mockRepo);  // 直接注入 mock

  const result = await service.createTask('openid123', { title: 'test' });

  expect(mockRepo.insert).toHaveBeenCalledTimes(1);
  expect(result.title).toBe('test');
});
```

---

## 5. 统一响应格式

所有接口返回统一格式：

```javascript
// 成功
{ "code": 0, "data": { ... }, "message": "ok" }

// 业务错误
{ "code": 400, "message": "参数错误" }

// 鉴权失败
{ "code": 401, "message": "未登录" }

// 服务器错误
{ "code": -1, "message": "服务器内部错误" }

// 资源不存在
{ "code": 404, "message": "任务不存在" }
```

**状态码约定：**

| code | 含义 |
|------|------|
| 0 | 成功 |
| — | 业务错误（自定义） |
| 400 | 参数错误 |
| 401 | 未鉴权 |
| 403 | 无权限（_openid 不匹配） |
| 404 | 资源不存在 |
| -1 | 服务器内部错误 |

---

## 6. 前端调用约定

### 6.1 封装基础请求

```javascript
// api/request.js
const callAPI = (url, data = {}) => {
  return wx.cloud.callFunction({
    name: 'focus-api',
    data: { $url: url, ...data },
  }).then(res => res.result);
};

module.exports = { callAPI };
```

### 6.2 按模块封装

```javascript
// api/task.api.js
const { callAPI } = require('./request');

const taskAPI = {
  create(title, priority = 'mid') {
    return callAPI('task/create', { title, priority });
  },
  list(filter = {}, page = 1, pageSize = 20) {
    return callAPI('task/list', { filter, page, pageSize });
  },
  update(id, data) {
    return callAPI('task/update', { id, data });
  },
  delete(id) {
    return callAPI('task/delete', { id });
  },
};

module.exports = taskAPI;
```

### 6.3 页面中使用

```javascript
// pages/todo/todo.js
const taskAPI = require('../../api/task.api');

Page({
  async onLoad() {
    wx.showLoading({ title: '加载中...' });
    const res = await taskAPI.list({ isDone: false });
    wx.hideLoading();
    if (res.code === 0) {
      this.setData({ tasks: res.data.tasks });
    }
  },
});
```

---

## 7. 扩展指南

### 7.1 新增一个接口的步骤

1. 在 `repositories/` 下新增（或复用）数据访问方法
2. 在 `services/` 下新增业务逻辑方法
3. 在 `routes/` 下新增路由处理函数
4. 在 `api/` 下新增前端调用封装
5. （可选）在 `docs/api-contracts.md` 更新接口文档

### 7.2 何时拆分多云函数

当项目遇到以下**任一**情况时，考虑将某个模块拆成独立云函数：

- 该模块的冷启动频次远高于其他模块（如 AI 教练可能偶尔使用，但统计页频繁查询）
- 该模块有特殊的依赖（如 AI 教练需要引入 `axios` 调外部 LLM API）
- 某个模块需要独立部署节奏（如统计模块改动频繁，不想影响核心专注流程）

拆分方式：

```
cloudfunctions/
├── focus-api/            # 核心：专注 + 待办 + 用户
├── stats-api/            # 独立：统计查询（高频访问）
└── coach-api/            # 独立：AI 教练（重型依赖）
```

每个独立云函数内部仍然保持 `routes/ → services/ → repositories/` 的分层结构。

---

## 8. 与现有代码的迁移策略

现有云函数：
- `cloudfunctions/login/` ✅ 保持不动（或后续迁移到 `focus-api` 的 `user/login` 路由）
- `cloudfunctions/completeFocusSession/` ✅ 保持不动（或后续迁移到 `focus-api` 的 `session/complete` 路由）
- `cloudfunctions/seed/` ✅ 种子数据脚本，保持独立

新开发的云函数代码统一放在 `cloudfunctions/focus-api/` 下。

> **迁移原则**：先新建后废弃。新接口在 `focus-api` 中实现，旧云函数保持可用。待所有调用方切换到新接口后，再删除旧云函数。

---

## 9. npm 依赖

```json
{
  "dependencies": {
    "@cloudbase/node-sdk": "^2.10.0",
    "tcb-router": "^1.2.0"
  }
}
```

部署前在 `cloudfunctions/focus-api/` 目录执行 `npm install`。

---

## 10. 参考资源

- [tcb-router — npm](https://www.npmjs.com/package/tcb-router) — Koa 风格云函数路由
- [@cloudbase/node-sdk — 官方文档](https://docs.cloudbase.net/api-reference/server/node-sdk/introduction)
- [微信云开发云函数文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html)
- [Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
