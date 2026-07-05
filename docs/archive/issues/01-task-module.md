# Issue #1: Task 待办模块 CRUD

> **认领人**: @开发者B
> **状态**: 🔲 待开发
> **预估工时**: 4h
> **标签**: `module/task`, `priority/p0`

---

## 概要

实现待办任务的增删改查四个接口，对接前端 `pages/todo/todo.js` 已有页面。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §2` | 接口入参/出参定义 |
| `docs/backend-architecture-v2.md` | 分层规范、工厂模式、DI 方式 |
| `cloudfunctions/focus-api/index.js` | 主入口（路由已挂载） |
| `cloudfunctions/focus-api/middleware/*` | 可直接使用的工具函数 |

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/services/task.service.js    # 业务逻辑
  cloudfunctions/focus-api/repositories/task.repo.js    # 数据访问
  miniprogram/api/task.api.js                           # 前端调用封装

需要修改:
  cloudfunctions/focus-api/routes/task.routes.js        # 路由处理（替换 stub）
```

## 详细实现要求

### 1. `repositories/task.repo.js`

数据访问层，操作 `tasks` 集合。

**方法列表**：

| 方法 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `static create()` | 工厂方法 | — | TaskRepo 实例 |
| `constructor(db)` | 接收 database 实例 | `db` | — |
| `insert(data)` | 插入文档 | `data: object` | `{ _id, ...data }` |
| `findAll(where, { page, pageSize })` | 分页查询 | `where`, 分页参数 | `data[]` |
| `findById(id)` | 按 ID 查询 | `id: string` | `data \| null` |
| `updateById(id, data)` | 更新文档 | `id`, `data` | `{ updated: number }` |
| `deleteById(id)` | 删除文档 | `id` | `{ deleted: number }` |
| `count(where)` | 计数 | `where` | `number` |

**关键实现细节**：

- `findAll` 按 `sortOrder` 降序排列
- `updateById` 自动注入 `updatedAt: Date.now()`
- `insert` 返回完整文档（含 _id）
- `static create()` 内部通过 `@cloudbase/node-sdk` 初始化环境
- **注意**：微信云数据库的 `doc(id)` 方法需要传入完整字符串 ID

**代码模板**（参考 `docs/backend-architecture-v2.md §3.4`）：

```javascript
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

  async findById(id) {
    const res = await this.collection.doc(id).get();
    return res.data[0] || null;
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

### 2. `services/task.service.js`

业务逻辑层，不直接操作数据库。

**方法列表**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法，内部调用 `TaskRepo.create()` |
| `constructor(taskRepo)` | DI 构造函数 |
| `createTask(openId, { title, priority, estimatedPomodoros })` | 创建任务，构建完整 task 文档 |
| `getTasks(openId, { filter, page, pageSize })` | 查询任务列表，构建 where 条件 |
| `updateTask(openId, id, data)` | 更新任务，先查权限再更新 |
| `deleteTask(openId, id)` | 删除任务，先查权限再删除 |

**关键实现细节**：

- `createTask` 中构建的 task 对象必须包含 `_openid`
- `getTasks` 对 `filter.isDone` 和 `filter.priority` 做条件判断（非空时才加入 where）
- `updateTask` / `deleteTask` 需要先用 `findById` 检查文档是否存在且 `_openid` 匹配，不匹配返回 `null`（供路由层转 403）
- 分页参数做安全兜底：`pageSize` 最大 100

```javascript
class TaskService {
  constructor(taskRepo) {
    this.taskRepo = taskRepo;
  }

  static create() {
    const TaskRepo = require('../repositories/task.repo');
    return new TaskService(TaskRepo.create());
  }

  async createTask(openId, { title, priority = 'medium', estimatedPomodoros = 1 }) {
    const task = {
      _openid: openId,
      title: title.trim(),
      priority,
      isDone: false,
      completedPomodoros: 0,
      estimatedPomodoros,
      sortOrder: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return this.taskRepo.insert(task);
  }

  async getTasks(openId, { filter = {}, page = 1, pageSize = 20 }) {
    const where = { _openid: openId };
    if (filter.isDone !== undefined) where.isDone = filter.isDone;
    if (filter.priority) where.priority = filter.priority;

    const safeSize = Math.min(pageSize, 100);
    const [tasks, total] = await Promise.all([
      this.taskRepo.findAll(where, { page, pageSize: safeSize }),
      this.taskRepo.count(where),
    ]);

    return { tasks, total, hasMore: page * safeSize < total };
  }

  async updateTask(openId, id, data) {
    const existing = await this.taskRepo.findById(id);
    if (!existing) return null;              // 404
    if (existing._openid !== openId) return null; // 403（调用方需区分）

    delete data._openid; // 防止篡改
    delete data._id;
    return this.taskRepo.updateById(id, data);
  }

  async deleteTask(openId, id) {
    const existing = await this.taskRepo.findById(id);
    if (!existing) return null;
    if (existing._openid !== openId) return null;
    return this.taskRepo.deleteById(id);
  }
}

module.exports = TaskService;
```

### 3. `routes/task.routes.js`（替换现有 stub）

路由层，只做参数提取、校验、调用 service、组装响应。

**四个路由**：

| 路由 | 校验规则 | 成功响应 | 错误处理 |
|------|---------|---------|---------|
| `task/create` | title 必填(1-100), priority 可选枚举 | `succ(ctx, task)` | 400 |
| `task/list` | filter/page/pageSize 可选 | `succ(ctx, { tasks, total, hasMore })` | — |
| `task/update` | id 必填, data 对象 | `succ(ctx, { updated })` | 400/403/404 |
| `task/delete` | id 必填 | `succ(ctx, { deleted })` | 403/404 |

**关键实现细节**：

- 使用 `validate` 和 `V` 做参数校验（见 `middleware/validate.js`）
- 使用 `succ` 和 `fail` 做响应（见 `middleware/response.js`）
- Service 返回 `null` 表示资源不存在/无权限，路由层根据情况返回 403 或 404

```javascript
const TaskService = require('../services/task.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {
  app.router('task/create', async (ctx) => {
    const { title, priority, estimatedPomodoros } = ctx.event;
    if (!validate(ctx, { title: V.required(1, 100) })) return;

    const service = TaskService.create();
    const result = await service.createTask(ctx.OPENID, { title, priority, estimatedPomodoros });
    succ(ctx, result);
  });

  app.router('task/list', async (ctx) => {
    const { filter, page, pageSize } = ctx.event;

    const service = TaskService.create();
    const result = await service.getTasks(ctx.OPENID, { filter, page, pageSize });
    succ(ctx, result);
  });

  app.router('task/update', async (ctx) => {
    const { id, data } = ctx.event;
    if (!validate(ctx, { id: V.required() })) return;

    const service = TaskService.create();
    const result = await service.updateTask(ctx.OPENID, id, data || {});
    if (!result) {
      fail(ctx, 404, '任务不存在');
      return;
    }
    succ(ctx, result);
  });

  app.router('task/delete', async (ctx) => {
    const { id } = ctx.event;
    if (!validate(ctx, { id: V.required() })) return;

    const service = TaskService.create();
    const result = await service.deleteTask(ctx.OPENID, id);
    if (!result) {
      fail(ctx, 404, '任务不存在');
      return;
    }
    succ(ctx, result);
  });
};
```

### 4. `miniprogram/api/task.api.js`

前端 API 调用封装。

```javascript
const { callAPI } = require('./request');

const taskAPI = {
  create(title, priority = 'medium', estimatedPomodoros = 1) {
    return callAPI('task/create', { title, priority, estimatedPomodoros });
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

## 验收标准

- [ ] 4 个路由文件创建/修改完成，`index.js` 能正常 `require` 不报错
- [ ] 所有 Repo 方法实现完整（insert / findAll / findById / updateById / deleteById / count）
- [ ] Service 层正确处理 `_openid` 的权限校验
- [ ] 参数校验覆盖：title 为空、超长、priority 非法值
- [ ] DB 集合名称是 `tasks`
- [ ] 代码格式与架构文档中的示例一致

## 如何验证

部署云函数后，在微信开发者工具的 Console 中执行：

```javascript
// 创建任务
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/create', title: '测试任务', priority: 'high' }
}).then(console.log);

// 列表查询
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/list', filter: { isDone: false } }
}).then(console.log);
```

期望输出格式：`{ code: 0, data: { ... }, message: 'ok' }`
