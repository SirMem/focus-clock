# Issue #4: Diary 日记模块 CRUD

> **认领人**: @开发者C
> **状态**: 🔲 待开发
> **预估工时**: 3h
> **标签**: `module/diary`, `priority/p1`

---

## 概要

实现日记的增删改查四个接口，支持情绪标签筛选和日期筛选。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §5` | 接口入参/出参定义 |
| `docs/backend-architecture-v2.md §3` | 分层规范 |

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/services/diary.service.js
  cloudfunctions/focus-api/repositories/diary.repo.js
  miniprogram/api/diary.api.js

需要修改:
  cloudfunctions/focus-api/routes/diary.routes.js
```

## 详细实现要求

### 1. `repositories/diary.repo.js`

操作 `diaries` 集合。方法与 `task.repo.js` 基本相同：

- `insert(data)` / `findAll(where, { page, pageSize })` / `findById(id)` / `updateById(id, data)` / `deleteById(id)` / `count(where)`
- 排序按 `createdAt` 降序

### 2. `services/diary.service.js`

**方法**：

| 方法 | 说明 |
|------|------|
| `createDiary(openId, { content, emotionTags, tasks })` | 创建日记 |
| `getDiaries(openId, { page, pageSize, date, emotionTag })` | 查询日记列表 |
| `updateDiary(openId, id, data)` | 更新日记 |
| `deleteDiary(openId, id)` | 删除日记 |

**`createDiary` 实现细节**：

- `content` 直接保存（trim 处理）
- `emotionTags` 使用 `config/index.js` 中的 `EMOTION_TAGS` 做校验，只保存合法值
- `tasks` 是关联任务的 `_id` 数组，可空

**`getDiaries` 实现细节**：

- `date` 筛选：如果传了 date（格式 `YYYY-MM-DD`），需要计算当天 0 点和次日 0 点的时间戳，筛选 `createdAt` 在该范围内
- `emotionTag` 筛选：使用 `db.command.arrayContains(emotionTag)`（云数据库的数组包含查询）

### 3. `routes/diary.routes.js`

| 路由 | 校验规则 |
|------|---------|
| `diary/create` | content 必填(1-2000), emotionTags 可选字符串数组(≤5), tasks 可选 |
| `diary/list` | page/pageSize/date/emotionTag 可选 |
| `diary/update` | id 必填, data 对象 |
| `diary/delete` | id 必填 |

**云数据库数组查询**：

```javascript
// 按 emotionTag 筛选时
if (emotionTag) {
  where.emotionTags = ctx._.arrayContains(emotionTag);
}
```

### 4. `miniprogram/api/diary.api.js`

```javascript
const { callAPI } = require('./request');

const diaryAPI = {
  create(content, { emotionTags, tasks } = {}) {
    return callAPI('diary/create', { content, emotionTags, tasks });
  },
  list(params = {}) {
    return callAPI('diary/list', params);
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

## 验收标准

- [ ] 4 个路由完整实现，格式与契约一致
- [ ] 情绪标签校验只允许配置中的 7 种
- [ ] 按日期筛选（date 参数）正确过滤当天日记
- [ ] 按情绪标签筛选使用 `arrayContains` 正确工作
- [ ] `updateDiary` 和 `deleteDiary` 校验 `_openid` 所有权
