# 数据库 Schema 标准化规范

> **状态**: ✅ 已定稿 · 最后更新: 2026-07-07
> **作用**: 本项目所有 MongoDB 集合的唯一字段标准，AI 编程与人工开发的共同参考
> **对应**: API 契约 [api-contracts.md](./api-contracts.md) · 后端架构 [backend-architecture-v2.md](./backend-architecture-v2.md)

---

## 1. 全局命名规范

| 原则 | 规则 | 示例 |
|------|------|------|
| **大小写** | camelCase | `createdAt` |
| **布尔值** | 前缀 `is`/`has` | `isDone`, `isPomodoro` |
| **时间戳** | 后缀 `At` | `createdAt`, `completedAt` |
| **外键引用** | 后缀 `Id` | `taskId` |
| **数组** | 复数名词 | `subtasks`, `emotionTags` |
| **计数** | 后缀 `Count` | `pomodoroCount` |
| **时长** | 统一单位秒，字段名 `duration` | `duration: 1500` |
| **日期字符串** | `YYYY-MM-DD` 格式 | `date: "2026-06-29"` |
| **用户标识** | 数据库存 `_openid`，API 响应映射为 `openid` |  |

### 通用字段（所有集合）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 文档 ID，`users` 集合固定为 OPENID，其余自动生成 |
| `_openid` | string | **必填** — 微信用户标识，用于数据隔离；所有查询必须带此条件 |
| `createdAt` | number | 创建时间戳（ms） |
| `updatedAt` | number | 更新时间戳（ms） |

---

## 2. 集合全景

```
MongoDB (微信云数据库)
│
├── 📦 users              — 用户档案 + 偏好设置
│   └── 1 条 / 用户（文档 ID = OPENID）
│
├── 📦 tasks              — 待办任务（V2 标准）
│   └── N 条 / 用户
│
├── 📦 sessions           — 专注会话记录
│   └── N 条 / 用户
│
├── 📦 daily_summaries    — 日预聚合表（避免全量扫 session）
│   └── 1 条 / 天 / 用户
│
└── 📦 diaries            — 日记
    └── N 条 / 用户
```

---

## 3. `users` — 用户集合

**文档 ID** = OPENID（固定）

```json
{
  "_id": "o0x_sample_user_001",
  "_openid": "o0x_sample_user_001",
  "nickName": "张三",
  "avatarUrl": "https://example.com/avatar1.png",
  "createdAt": 1782291850314,
  "updatedAt": 1782291850314,
  "lastLoginAt": 1782291850314,
  "settings": {
    "focusDuration": 25,
    "shortBreak": 5,
    "longBreak": 15,
    "dailyGoal": 4
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `_id` | string | ✅ | OPENID | 文档 ID 固定为 openid，实现 upsert 登录 |
| `_openid` | string | ✅ | OPENID | 冗余存储，方便 where 查询 |
| `nickName` | string | ✅ | `'微信用户'` | 微信昵称 |
| `avatarUrl` | string | ✅ | `''` | 头像 URL |
| `createdAt` | number | ✅ | `Date.now()` | 注册时间 |
| `updatedAt` | number | ✅ | `Date.now()` | 最后更新 |
| `lastLoginAt` | number | ✅ | `Date.now()` | 最后登录 |
| `settings` | object | ✅ | 见下方 | 用户偏好设置 |

### settings 嵌套对象

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `focusDuration` | number | `25` | 专注时长（分钟） |
| `shortBreak` | number | `5` | 短休息（分钟） |
| `longBreak` | number | `15` | 长休息（分钟） |
| `dailyGoal` | number | `4` | 每日目标番茄数 |

### 索引

| 索引字段 | 说明 |
|----------|------|
| `_id` (主键) | 文档 ID 查询 |
| `_openid` | 按用户查询（冗余） |

---

## 4. `tasks` — 待办任务集合（V2 标准）

```json
{
  "_id": "sample_task_001",
  "_openid": "o0x_sample_user_001",
  "title": "复习高数第三章",
  "description": "微积分重要考点：极限与连续",
  "priority": "high",
  "isDone": false,
  "estimatedPomodoros": 4,
  "completedPomodoros": 0,
  "subtasks": [
    {
      "id": "sub_001",
      "title": "看教材第3章",
      "completed": true,
      "createdAt": 1782291850314,
      "updatedAt": 1782291850314
    },
    {
      "id": "sub_002",
      "title": "做完课后习题",
      "completed": false,
      "createdAt": 1782291850314,
      "updatedAt": 1782291850314
    }
  ],
  "dueAt": 1782892800000,
  "repeat": {
    "enabled": false,
    "type": "none",
    "interval": 1
  },
  "sortOrder": 1782291850314,
  "createdAt": 1782291850314,
  "updatedAt": 1782291850314,
  "completedAt": null
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | ✅ | — | 1-100 字符 |
| `description` | string | ❌ | `''` | 最多 500 字 |
| `priority` | string | ❌ | `'medium'` | `'high'` \| `'medium'` \| `'low'` |
| `isDone` | boolean | ❌ | `false` | 完成状态 |
| `estimatedPomodoros` | number | ❌ | `1` | 预估番茄数，范围 1-12 |
| `completedPomodoros` | number | ❌ | `0` | 实际完成番茄数（由 session 自动递增） |
| `subtasks` | array | ❌ | `[]` | 子任务列表 |
| `dueAt` | number\|null | ❌ | `null` | 截止日期时间戳（ms） |
| `repeat` | object | ❌ | `{enabled:false, type:'none', interval:1}` | 重复规则 |
| `sortOrder` | number | ✅ | `Date.now()` | 排序权重，越大越靠前 |
| `completedAt` | number\|null | ❌ | `null` | 完成时间，isDone=true 时写入 |

### subtasks[].item

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 子任务唯一 ID |
| `title` | string | 1-100 字符 |
| `completed` | boolean | 是否完成 |
| `createdAt` | number | 创建时间 |
| `updatedAt` | number | 更新时间 |

### repeat 对象

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 是否启用重复 |
| `type` | string | `'none'` | `'none'` \| `'daily'` \| `'weekly'` \| `'weekdays'` |
| `interval` | number | `1` | 间隔，范围 1-365 |

### 索引

| 索引字段 | 说明 |
|----------|------|
| `_openid` | 用户数据隔离 |
| `_openid` + `isDone` | 按完成状态筛选 |
| `_openid` + `sortOrder` | 排序查询 |

### 字段名称变更对照（← 旧 seed）

| 旧字段 | 新字段 | 变更原因 |
|--------|--------|----------|
| `text` | `title` | 语义更清晰，与前端表单统一 |
| `done` | `isDone` | 布尔值统一 `is` 前缀 |
| `pomodoros` | `estimatedPomodoros` | 消除歧义：是预估还是已完成？ |
| `completed` | `completedPomodoros` | 同上，避免与 `isDone` 混淆 |
| `totalFocusMinutes` | ❌ **删除** | 冗余字段，由 sessions 聚合 |
| `priority` → 值变更 | `'urgent_important'`→`'high'`等 | 简化为三档，与 UI 对齐 |
| (新增) | `subtasks` | 子任务支持 |
| (新增) | `dueAt` | 截止日期 |
| (新增) | `repeat` | 重复规则 |
| (新增) | `sortOrder` | 排序 |
| (新增) | `completedAt` | 完成时间戳 |

---

## 5. `sessions` — 专注会话集合

```json
{
  "_id": "session_001",
  "_openid": "o0x_sample_user_001",
  "mode": "focus",
  "duration": 1500,
  "startedAt": 1782662650314,
  "completedAt": 1782664150314,
  "taskId": "sample_task_001",
  "isPomodoro": true,
  "createdAt": 1782664150314
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mode` | string | ✅ | `'focus'` \| `'shortBreak'` \| `'longBreak'` |
| `duration` | number | ✅ | **单位: 秒**（前端传 25×60=1500） |
| `startedAt` | number | ✅ | 开始时间戳（ms），`completedAt - duration*1000` |
| `completedAt` | number | ✅ | 结束时间戳（ms） |
| `taskId` | string\|null | ❌ | 关联的任务 _id |
| `isPomodoro` | boolean | ✅ | 是否计入番茄统计（focus + 完整番茄） |
| `createdAt` | number | ✅ | 创建时间 |

### 索引

| 索引字段 | 说明 |
|----------|------|
| `_openid` + `completedAt` | 按日期范围查询 + 排序 |
| `_openid` + `taskId` | 按任务查询关联会话 |

### 字段名称变更对照（← 旧 seed）

| 旧字段 | 新字段 | 变更原因 |
|--------|--------|----------|
| `type` | `mode` | `type` 是 MongoDB 保留字倾向，`mode` 语义更准 |
| `startTime` | `startedAt` | 统一时间戳后缀 `At` |
| `endTime` | `completedAt` | 同上，明确"已完成" |
| `taskName` | ❌ **删除** | 冗余，通过 taskId 关联查询 |
| (新增) | `isPomodoro` | 区分是否统计 |
| `duration` 分钟 → 秒 | ⚠️ **单位变更** | 前端用秒，seed 数据需 ×60 |

---

## 6. `daily_summaries` — 日预聚合集合

```json
{
  "_id": "daily_summary_001",
  "_openid": "o0x_sample_user_001",
  "date": "2026-06-29",
  "focusMinutes": 75,
  "pomodoroCount": 3,
  "completedTasks": 0,
  "aiScore": 75,
  "createdAt": 1782723850314,
  "updatedAt": 1782723850314
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `date` | string | ✅ | — | `YYYY-MM-DD` |
| `focusMinutes` | number | ✅ | `0` | 当日专注总分钟，**通过 `_.inc()` 增量累加** |
| `pomodoroCount` | number | ✅ | `0` | 当日完成番茄数，**增量累加** |
| `completedTasks` | number | ✅ | `0` | 当日完成任务数，**增量累加**（当前仅占位） |
| `aiScore` | number\|null | ❌ | `null` | AI 评分 0-100，由 coach 定时写入 |

### upsert 机制

```
session/complete
  └→ dailySummaryRepo.upsert(openId, dateStr, {
        focusMinutes: Math.round(duration / 60),   // 秒→分钟
        pomodoroCount: 1
      })
        ├─ 已有记录 → _.inc({ focusMinutes, pomodoroCount })
        └─ 无记录  → 创建新文档
```

**注意**: `completedTasks` 字段虽然 schema 预留，但当前 session.complete 未传此增量。

### 索引

| 索引字段 | 说明 |
|----------|------|
| `_openid` + `date` | 按日期查询（复合唯一） |

### 字段名称变更对照（← 旧 seed）

| 旧字段 | 新字段 | 变更原因 |
|--------|--------|----------|
| `totalPomodoros` | `pomodoroCount` | 简洁，与代码一致 |
| `totalFocusMinutes` | `focusMinutes` | 简洁，与代码一致 |
| (新增) | `completedTasks` | 代码已支持但 seed 缺失 |

---

## 7. `diaries` — 日记集合

```json
{
  "_id": "diary_001",
  "_openid": "o0x_sample_user_001",
  "content": "今天完成了高数第三章复习，感觉对极限部分的理解更深了。下午写了项目文档的初稿，明天继续完善。",
  "emotionTags": ["开心", "平静"],
  "tasks": ["sample_task_001"],
  "createdAt": 1782723850314,
  "updatedAt": 1782723850314
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `content` | string | ✅ | — | 1-2000 字符 |
| `emotionTags` | string[] | ❌ | `[]` | 情绪标签数组，最多 5 个；可选值: `开心` \| `平静` \| `焦虑` \| `疲惫` \| `沮丧` \| `兴奋` \| `无聊` |
| `tasks` | string[] | ❌ | `[]` | 关联的任务 _id 列表（当前仅占位） |

### 索引

| 索引字段 | 说明 |
|----------|------|
| `_openid` + `createdAt` | 日记列表分页查询 |
| `_openid` + `emotionTags` | 按情绪筛选 |

---

## 8. 字段变更映射总表

| 集合 | 旧 seed 字段 | 标准字段 | 影响范围 |
|------|-------------|----------|----------|
| **tasks** | `text` | `title` | 前端表单、API 请求体、Repo |
| | `done` | `isDone` | task.repo、route 层 |
| | `pomodoros` | `estimatedPomodoros` | 任务创建 API |
| | `completed` | `completedPomodoros` | session 完成回调 |
| | `totalFocusMinutes` | ❌ 删除 | — |
| | `priority` 值变更 | `urgent_important`→`high` | 枚举值全部重映射 |
| | (新增) | `subtasks` | 前端 todo 表单 |
| | (新增) | `dueAt` | 前端 todo 表单 |
| | (新增) | `repeat` | 前端 todo 表单 |
| | (新增) | `sortOrder` | 排序 |
| | (新增) | `completedAt` | isDone 回调 |
| **sessions** | `type` | `mode` | 前端 focus 页、API |
| | `startTime` | `startedAt` | session.repo |
| | `endTime` | `completedAt` | session.repo、查询条件 |
| | `taskName` | ❌ 删除 | 冗余 |
| | (新增) | `isPomodoro` | 统计逻辑 |
| | `duration` 分钟→秒 | 单位变更 | ⚠️ 前端传值、统计计算 |
| **daily_summaries** | `totalPomodoros` | `pomodoroCount` | stats 模块 |
| | `totalFocusMinutes` | `focusMinutes` | stats 模块 |
| | (新增) | `completedTasks` | 预留字段 |
| **diaries** | (无 seed) | — | 按 API 契约创建 |
| **users** | 无变更 | — | — |

---

## 9. 数据一致性约束

### 9.1 `tasks.completedPomodoros` 的原子递增

```javascript
// session.service.js — completeSession()
// 每个番茄钟完成时自动递增
task = await taskRepo.incrementCompleted(openId, taskId);
// → 执行 db.collection('tasks').doc(taskId).update({
//     completedPomodoros: _.inc(1)
//   })
```

### 9.2 `daily_summaries` 的 upsert 原子累加

```javascript
// daily-summary.repo.js — upsert()
// 不存在→创建，存在→增量累加
await this.collection.where({ _openid: openId, date }).update({
  data: {
    focusMinutes: _.inc(increments.focusMinutes),
    pomodoroCount: _.inc(increments.pomodoroCount),
  }
});
// 如果 update 结果 matched=0，则创建新文档
```

### 9.3 `isDone` 与 `completedAt` 联动

```javascript
// task.repo.js — update()
if (data.isDone === true) data.completedAt = Date.now();
if (data.isDone === false) data.completedAt = null;
```

---

## 10. 验证规则速查

| 集合 | 字段 | 规则 |
|------|------|------|
| tasks | `title` | 必填，1-100 字符 |
| | `description` | 最多 500 字符 |
| | `estimatedPomodoros` | 1-12 整数 |
| | `priority` | 必须为 `high`/`medium`/`low` |
| | `subtasks` | 最多 20 个 |
| | `repeat.type` | 必须为 `none`/`daily`/`weekly`/`weekdays` |
| | `repeat.interval` | 1-365 整数 |
| sessions | `mode` | 必须为 `focus`/`shortBreak`/`longBreak` |
| | `duration` | > 0（秒） |
| diaries | `content` | 必填，1-2000 字符 |
| | `emotionTags` | 最多 5 个，值必须在白名单内 |
