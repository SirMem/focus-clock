# Dev Spec: Task 模块后端 + 前端 API

## 文件清单

创建以下 3 个文件，修改 1 个文件：

| 操作 | 文件路径 |
|------|---------|
| 创建 | `cloudfunctions/focus-api/services/task.service.js` |
| 创建 | `cloudfunctions/focus-api/repositories/task.repo.js` |
| 创建 | `miniprogram/api/task.api.js` |
| 修改 | `cloudfunctions/focus-api/routes/task.routes.js`（替换全部内容） |

## 1. `repositories/task.repo.js`

### 骨架

```javascript
const { getDateStr } = require('../utils/helpers');

class TaskRepo {

  constructor(db) {
    this.collection = db.collection('tasks');
  }

  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new TaskRepo(app.database());
  }

  // ——— 方法清单 ———

  async insert(data) {}
  async findAll(where, { page, pageSize } = {}) {}
  async findById(id) {}
  async updateById(id, data) {}
  async deleteById(id) {}
  async count(where) {}
}
```

### 方法实现细节

**insert(data)**
- 调用 `this.collection.add({ data })`
- 返回 `{ _id: res.id, ...data }`

**findAll(where, { page = 1, pageSize = 20 } = {})**
- 调用 `.where(where).orderBy('sortOrder', 'desc').skip((page-1)*pageSize).limit(pageSize).get()`
- 返回 `res.data`

**findById(id)**
- 无分页
- 返回 `res.data[0]` 或 `null`

**updateById(id, data)**
- 注入 `updatedAt: Date.now()` 到 data
- 调用 `this.collection.doc(id).update({ data })`
- 返回 `{ updated: 1 }`

**deleteById(id)**
- 调用 `this.collection.doc(id).remove()`
- 返回 `{ deleted: 1 }`

**count(where)**
- 调用 `.where(where).count()`
- 返回 `res.total`

## 2. `services/task.service.js`

### 骨架

```javascript
const TaskRepo = require('../repositories/task.repo');

class TaskService {

  constructor(taskRepo) {
    this.taskRepo = taskRepo;
  }

  static create() {
    return new TaskService(TaskRepo.create());
  }

  async createTask(openId, { title, priority, estimatedPomodoros }) {}
  async getTasks(openId, { filter, page, pageSize }) {}
  async updateTask(openId, id, data) {}
  async deleteTask(openId, id) {}
}

module.exports = TaskService;
```

### 方法实现细节

**createTask(openId, { title, priority = 'medium', estimatedPomodoros = 1 })**

构建 task 文档：
```javascript
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
```
调用 `this.taskRepo.insert(task)`，返回结果。

**getTasks(openId, { filter = {}, page = 1, pageSize = 20 })**
- 构建 where: `{ _openid: openId }`
- 如果 `filter.isDone !== undefined`，追加 `isDone: filter.isDone`
- 如果 `filter.priority`，追加 `priority: filter.priority`
- 并行调用 `this.taskRepo.findAll(where, { page, pageSize })` 和 `this.taskRepo.count(where)`
- 返回 `{ tasks, total, hasMore: page * pageSize < total }`

**updateTask(openId, id, data)**
- 先调用 `this.taskRepo.findById(id)` 检查存在性和 `_openid` 所有权
- 如果不存在，返回 `null`
- 如果 `data._openid !== openId`（校验字段级权限），返回 `null`
- 从 `data` 中删除 `_openid`、`_id`（不允许通过这些字段）
- 调用 `this.taskRepo.updateById(id, data)`
- 返回 `this.taskRepo.findById(id)`（返回更新后的完整文档）

**deleteTask(openId, id)**
- 先调用 `this.taskRepo.findById(id)` 检查所有权
- 如果不存在或 `_openid !== openId`，返回 `null`
- 调用 `this.taskRepo.deleteById(id)`
- 返回 `{ deleted: true }`

## 3. `routes/task.routes.js`（替换全部内容）

```javascript
const TaskService = require('../services/task.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  task/create
  // ═══════════════════════════════════════════════════

  app.router('task/create', async (ctx) => {
    const { title, priority, estimatedPomodoros } = ctx.event;

    if (!validate(ctx, { title: V.required(1, 100) })) return;
    if (priority && !validate(ctx, { priority: V.enum(['high', 'medium', 'low']) })) return;

    const service = TaskService.create();
    const result = await service.createTask(ctx.OPENID, { title, priority, estimatedPomodoros });
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  task/list
  // ═══════════════════════════════════════════════════

  app.router('task/list', async (ctx) => {
    const { filter, page, pageSize } = ctx.event;

    const service = TaskService.create();
    const result = await service.getTasks(ctx.OPENID, { filter, page, pageSize });
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  task/update
  // ═══════════════════════════════════════════════════

  app.router('task/update', async (ctx) => {
    const { id, data } = ctx.event;

    if (!validate(ctx, { id: V.required() })) return;
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      fail(ctx, 400, '更新数据不能为空');
      return;
    }

    const service = TaskService.create();
    const result = await service.updateTask(ctx.OPENID, id, data);
    if (!result) {
      fail(ctx, 404, '任务不存在或无权操作');
      return;
    }
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  task/delete
  // ═══════════════════════════════════════════════════

  app.router('task/delete', async (ctx) => {
    const { id } = ctx.event;

    if (!validate(ctx, { id: V.required() })) return;

    const service = TaskService.create();
    const result = await service.deleteTask(ctx.OPENID, id);
    if (!result) {
      fail(ctx, 404, '任务不存在或无权操作');
      return;
    }
    succ(ctx, result);
  });

};
```

## 4. `miniprogram/api/task.api.js`

```javascript
const { callAPI } = require('./request');

const taskAPI = {
  create(title, priority, estimatedPomodoros) {
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

## 验收检查表

- [ ] 4 个文件都已创建/修改
- [ ] `task.service.js` 通过构造函数接收 `taskRepo` 参数
- [ ] `task.service.js` 有 `static create()` 工厂方法
- [ ] `task.repo.js` 有 `static create()` 工厂方法
- [ ] `task.routes.js` 的 `_openid` 校验在 service 层（update/delete 时检查所有权）
- [ ] 所有路由通过 `middleware/validate.js` 做参数校验
- [ ] 所有响应通过 `middleware/response.js` 的 `succ/fail` 返回
- [ ] 没有修改 `index.js` 或其他模块的文件

## 验证方法

部署到云环境后，在 DevTools Console 执行以下代码进行手动测试：

```javascript
// 1. 创建任务
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/create', title: '测试任务', priority: 'high', estimatedPomodoros: 3 }
}).then(r => console.log('创建:', r.result));
// 期望: { code: 0, data: { _id: "...", title: "测试任务", priority: "high", ... } }

// 2. 获取任务列表
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/list', filter: {}, page: 1, pageSize: 20 }
}).then(r => console.log('列表:', r.result));
// 期望: { code: 0, data: { tasks: [...], total: 1, hasMore: false } }

// 3. 更新任务（把上一步拿到的 _id 填入）
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/update', id: 'PASTE_TASK_ID_HERE', data: { isDone: true } }
}).then(r => console.log('更新:', r.result));

// 4. 删除任务
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'task/delete', id: 'PASTE_TASK_ID_HERE' }
}).then(r => console.log('删除:', r.result));
```
