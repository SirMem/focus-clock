# Issue #2: Session 专注会话模块

> **认领人**: @开发者B
> **状态**: 🔲 待开发
> **预估工时**: 3h
> **标签**: `module/session`, `priority/p0`

---

## 概要

实现专注会话的完成记录和查询接口。当用户完成一个番茄钟时调用 `session/complete` 记录数据并更新当日统计。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §3` | 接口入参/出参定义 |
| `docs/backend-architecture-v2.md §3` | 分层规范 |
| `cloudfunctions/completeFocusSession/index.js` | 现有旧云函数（参考逻辑，不需要复用代码） |

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/repositories/session.repo.js    # 数据访问
  cloudfunctions/focus-api/repositories/daily-summary.repo.js  # 日汇总数据访问
  cloudfunctions/focus-api/services/session.service.js     # 业务逻辑
  miniprogram/api/session.api.js                           # 前端调用封装

需要修改:
  cloudfunctions/focus-api/routes/session.routes.js        # 路由处理（替换 stub）
```

## 详细实现要求

### 1. `repositories/session.repo.js`

操作 `sessions` 集合。

**方法**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法 |
| `insert(data)` | 插入会话记录 |
| `findAll(where, { page, pageSize })` | 分页查询，按 completedAt 降序 |
| `count(where)` | 计数 |
| `getTodaySessions(openId)` | 查询当日所有专注会话 |

**`getTodaySessions` 实现**：使用 `getDateStr()` 获取今天日期，查询 `completedAt >= 今天0点` 的所有 sessions。

### 2. `repositories/daily-summary.repo.js`

操作 `daily_summaries` 集合。这是一个预聚合集合，每天一条记录，避免每次都全量扫描 sessions。

**方法**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法 |
| `upsert(openId, date, updates)` | 插入或更新当日汇总 |

**`upsert` 实现细节**：

```javascript
async upsert(openId, date, updates) {
  const where = { _openid: openId, date };
  const existing = await this.collection.where(where).get();
  if (existing.data.length > 0) {
    return this.collection.doc(existing.data[0]._id).update({
      data: { ...updates, updatedAt: Date.now() },
    });
  } else {
    return this.collection.add({
      data: {
        _openid: openId,
        date,
        focusMinutes: 0,
        pomodoroCount: 0,
        completedTasks: 0,
        ...updates,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  }
}
```

### 3. `services/session.service.js`

业务逻辑层。

**方法**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法 |
| `completeSession(openId, { mode, duration, taskId, completedPomodoro })` | 完成会话 |
| `getSessions(openId, { page, pageSize, startDate, endDate })` | 历史查询 |

**`completeSession` 实现细节**：

1. 构建 session 文档：`{ _openid, mode, duration（秒）, startedAt, completedAt: Date.now(), taskId, isPomodoro: mode === 'focus' && completedPomodoro !== false }`
   - `startedAt = completedAt - duration * 1000`
2. 插入 session 记录
3. 如果 `isPomodoro`，更新 `daily_summaries`（`focusMinutes += Math.round(duration / 60)`, `pomodoroCount += 1`）
4. 如果有关联的 `taskId`，更新对应 task 的 `completedPomodoros += 1`
5. 构建当日累计统计并返回

**当日累计统计**：直接 `this.sessionRepo.getTodaySessions(openId)` 然后聚合计算。

### 4. `routes/session.routes.js`

| 路由 | 校验规则 |
|------|---------|
| `session/complete` | mode 必填枚举('focus','shortBreak','longBreak'), duration 必填正数, taskId 可选 |
| `session/list` | page/pageSize/startDate/endDate 可选 |

### 5. `miniprogram/api/session.api.js`

```javascript
const { callAPI } = require('./request');

const sessionAPI = {
  complete(mode, duration, { taskId, completedPomodoro } = {}) {
    return callAPI('session/complete', { mode, duration, taskId, completedPomodoro });
  },
  list(params = {}) {
    return callAPI('session/list', params);
  },
};

module.exports = sessionAPI;
```

## 关联

- 完成此 Issue 后，`focus.js` 可以在番茄结束时调用 `sessionAPI.complete('focus', timeLeft, { taskId })`
- 参考现有 `cloudfunctions/completeFocusSession/index.js` 了解当前记录了什么字段，但**不要复制代码**——按新架构重新实现

## 验收标准

- [ ] `session/complete` 正确记录会话并更新日汇总
- [ ] `session/list` 支持日期范围筛选和分页
- [ ] 关联 taskId 时正确递增 task 的 `completedPomodoros`
- [ ] 不关联 taskId 时也能正常完成（空值安全）
- [ ] 日汇总集合 `daily_summaries` 通过 upsert 操作，不产生重复记录
