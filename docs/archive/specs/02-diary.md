# Dev Spec: Diary 模块后端 + 前端 API

## 文件清单

创建以下 3 个文件，修改 1 个文件：

| 操作 | 文件路径 |
|------|---------|
| 创建 | `cloudfunctions/focus-api/services/diary.service.js` |
| 创建 | `cloudfunctions/focus-api/repositories/diary.repo.js` |
| 创建 | `miniprogram/api/diary.api.js` |
| 修改 | `cloudfunctions/focus-api/routes/diary.routes.js`（替换全部内容） |

## 1. `repositories/diary.repo.js`

### 骨架

```javascript
class DiaryRepo {

  constructor(db) {
    this.collection = db.collection('diary_entries');
  }

  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new DiaryRepo(app.database());
  }

  async insert(data) {}
  async findAll(where, { page, pageSize } = {}) {}
  async findById(id) {}
  async updateById(id, data) {}
  async deleteById(id) {}
  async count(where) {}
}
```

### 方法实现细节

所有方法与 `task.repo.js` 完全一致：

- **insert(data)**: `add` → 返回 `{ _id: res.id, ...data }`
- **findAll(where, pagination)**: `orderBy('createdAt', 'desc')` 排序，skip/limit 分页
- **findById(id)**: `doc(id).get()` → `res.data[0]` 或 `null`
- **updateById(id, data)**: 自动注入 `updatedAt: Date.now()`
- **deleteById(id)**: `doc(id).remove()`
- **count(where)**: `.where(where).count()` → `res.total`

## 2. `services/diary.service.js`

### 骨架

```javascript
const DiaryRepo = require('../repositories/diary.repo');
const { getDateStr } = require('../utils/helpers');

class DiaryService {

  constructor(diaryRepo) {
    this.diaryRepo = diaryRepo;
  }

  static create() {
    return new DiaryService(DiaryRepo.create());
  }

  async createEntry(openId, { title, content, mood, tags }) {}
  async getEntries(openId, { page, pageSize, startDate, endDate }) {}
  async updateEntry(openId, id, data) {}
  async deleteEntry(openId, id) {}
  async getEntryById(openId, id) {}
}

module.exports = DiaryService;
```

### 方法实现细节

**createEntry(openId, { title, content, mood, tags = [] })**
- 构建文档:
```javascript
{
  _openid: openId,
  date: getDateStr(),
  title,
  content,
  mood: mood || null,
  tags: tags || [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
```
- 调用 `this.diaryRepo.insert(doc)`，返回结果

**getEntries(openId, { page = 1, pageSize = 20, startDate, endDate })**
- 构建 where: `{ _openid: openId }`
- 如果 `startDate`，追加 `date: this.diaryRepo._.gte(startDate)`（用 `this.diaryRepo._`）
- 注意：`this.diaryRepo._` 需要在 repo 中暴露 `this._ = db.command`
- 如果 `endDate`，追加 `date: this.diaryRepo._.lte(endDate)`
- 返回 `{ entries, total, hasMore }`

**updateEntry(openId, id, data)**
- 先 findById 检查存在性和 `_openid` 所有权
- 如果不存在或 `_openid !== openId`，返回 `null`
- 从 data 中删除 `_openid`、`_id`、`createdAt`
- 调用 updateById
- 返回更新后的文档

**deleteEntry(openId, id)**
- 先 findById 检查所有权
- 不存在或 `_openid !== openId` → 返回 `null`
- 调用 deleteById → 返回 `{ deleted: true }`

**getEntryById(openId, id)**
- 调用 `findById(id)`
- 如果不存在或 `_openid !== openId` → 返回 `null`
- 返回文档

## 3. `routes/diary.routes.js`（替换全部内容）

```javascript
const DiaryService = require('../services/diary.service');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  diary/create
  // ═══════════════════════════════════════════════════

  app.router('diary/create', async (ctx) => {
    const { title, content, mood, tags } = ctx.event;

    if (!validate(ctx, { title: V.required(1, 200) })) return;
    if (!validate(ctx, { content: V.required(1) })) return;
    if (mood && !validate(ctx, { mood: V.enum(['happy', 'calm', 'sad', 'anxious', 'focused']) })) return;

    const service = DiaryService.create();
    const result = await service.createEntry(ctx.OPENID, { title, content, mood, tags });
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  diary/list
  // ═══════════════════════════════════════════════════

  app.router('diary/list', async (ctx) => {
    const { page, pageSize, startDate, endDate } = ctx.event;

    const service = DiaryService.create();
    const result = await service.getEntries(ctx.OPENID, { page, pageSize, startDate, endDate });
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  diary/get
  // ═══════════════════════════════════════════════════

  app.router('diary/get', async (ctx) => {
    const { id } = ctx.event;

    if (!validate(ctx, { id: V.required() })) return;

    const service = DiaryService.create();
    const result = await service.getEntryById(ctx.OPENID, id);
    if (!result) {
      fail(ctx, 404, '日记不存在或无权访问');
      return;
    }
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  diary/update
  // ═══════════════════════════════════════════════════

  app.router('diary/update', async (ctx) => {
    const { id, data } = ctx.event;

    if (!validate(ctx, { id: V.required() })) return;
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      fail(ctx, 400, '更新数据不能为空');
      return;
    }

    const service = DiaryService.create();
    const result = await service.updateEntry(ctx.OPENID, id, data);
    if (!result) {
      fail(ctx, 404, '日记不存在或无权操作');
      return;
    }
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  diary/delete
  // ═══════════════════════════════════════════════════

  app.router('diary/delete', async (ctx) => {
    const { id } = ctx.event;

    if (!validate(ctx, { id: V.required() })) return;

    const service = DiaryService.create();
    const result = await service.deleteEntry(ctx.OPENID, id);
    if (!result) {
      fail(ctx, 404, '日记不存在或无权操作');
      return;
    }
    succ(ctx, result);
  });

};
```

## 4. `miniprogram/api/diary.api.js`

```javascript
const { callAPI } = require('./request');

const diaryAPI = {
  create(title, content, mood, tags) {
    return callAPI('diary/create', { title, content, mood, tags });
  },
  list({ page, pageSize, startDate, endDate } = {}) {
    return callAPI('diary/list', { page, pageSize, startDate, endDate });
  },
  get(id) {
    return callAPI('diary/get', { id });
  },
  update(id, data) {
    return callAPI('diary/update', { id, data });
  },
  delete(id) {
    return callAPI('diary/delete', { id });
  },
};

module.exports = diaryAPI;
```

## 验收检查表

- [ ] 4 个文件都已创建/修改
- [ ] `diary.repo.js` 的 `findAll` 按 `createdAt` 降序排序
- [ ] `diary.service.js` 的 update/delete 校验了 `_openid` 所有权
- [ ] mood 枚举值包含: happy, calm, sad, anxious, focused
- [ ] 没有修改 `index.js` 或其他模块的文件

## 验证方法

部署到云环境后，在 DevTools Console 执行：

```javascript
// 1. 创建日记
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'diary/create', title: '测试日记', content: '今天测试云函数', mood: 'calm' }
}).then(r => console.log('创建:', r.result));
// 期望: { code: 0, data: { _id: "...", title: "测试日记", mood: "calm", ... } }

// 2. 获取日记列表
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'diary/list', page: 1, pageSize: 20 }
}).then(r => console.log('列表:', r.result));

// 3. 更新日记
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'diary/update', id: 'PASTE_DIARY_ID_HERE', data: { content: '更新后的内容' } }
}).then(r => console.log('更新:', r.result));

// 4. 删除日记
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'diary/delete', id: 'PASTE_DIARY_ID_HERE' }
}).then(r => console.log('删除:', r.result));
```
