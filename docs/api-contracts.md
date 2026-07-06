# API 接口契约

> 状态: ✅ 已定稿 · 最后更新: 2026-07-04
> 对应架构: [backend-architecture-v2.md](./backend-architecture-v2.md)
> 本文件是所有前后端联调的唯一参考，变更需更新版本号

---

## 目录

- [通用约定](#1-通用约定)
- [Task 待办模块](#2-task-待办模块)
- [Session 专注会话模块](#3-session-专注会话模块)
- [Stats 统计模块](#4-stats-统计模块)
- [Diary 日记模块](#5-diary-日记模块)
- [User 用户模块](#6-user-用户模块)
- [Coach AI 教练模块](#7-coach-ai-教练模块)

---

## 1. 通用约定

### 1.1 调用方式

```javascript
// 前端统一通过 api/request.js 调用
const res = await wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'module/action', ...params }
});
// res.result → { code, data, message }
```

### 1.2 统一响应格式

```typescript
// 成功
{ code: 0, data: T, message: 'ok' }

// 业务错误
{ code: 400, message: '参数错误' }     // 参数校验失败
{ code: 401, message: '未登录' }       // OPENID 不存在
{ code: 403, message: '无权限' }       // _openid 不匹配
{ code: 404, message: '资源不存在' }    // 数据未找到
{ code: -1, message: '服务器内部错误' }  // 未捕获异常
```

### 1.3 通用参数说明

| 参数 | 位置 | 说明 |
|------|------|------|
| `$url` | data | tcb-router 路由标识，格式 `module/action` |
| `OPENID` | 云函数上下文 | 服务端通过 `wx-server-sdk` 的 `cloud.getWXContext().OPENID` 获取，并由鉴权中间件注入到 `ctx.OPENID`；前端不得传 openid |

### 1.4 数据库约定

| 字段 | 说明 |
|------|------|
| `_id` | 文档 ID（string）；`users` 集合固定使用 OPENID 作为 `_id`，业务数据集合仍可自动生成 |
| `_openid` | 微信用户标识，用于数据隔离 |
| `createdAt` | 创建时间戳（number, ms） |
| `updatedAt` | 更新时间戳（number, ms） |

---

## 2. Task 待办模块

> Task v2 标准详见 `docs/dev-specs/frontend-v2/10-task-v2.md`。本模块以“轻量任务规划器”为目标，支持 Quick Add 与完整任务弹窗两种创建路径。

### 2.0 TaskV2 数据模型

```typescript
type TaskPriority = 'high' | 'medium' | 'low';
type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'weekdays';

type TaskV2 = {
  _id: string;
  _openid: string;
  title: string;                 // 1-100 字符
  description: string;           // 默认 ''，最多 500 字
  priority: TaskPriority;         // 默认 'medium'
  isDone: boolean;                // 默认 false
  completedPomodoros: number;     // 默认 0
  estimatedPomodoros: number;     // 默认 1，范围 1-12
  subtasks: Array<{
    id: string;
    title: string;               // 1-100 字符
    completed: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
  dueAt: number | null;           // ms 时间戳，未设置为 null
  repeat: {
    enabled: boolean;
    type: TaskRepeatType;
    interval: number;             // 默认 1
  };
  sortOrder: number;              // 用于排序的时间戳
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
```

#### 默认值

```typescript
{
  description: '',
  priority: 'medium',
  isDone: false,
  completedPomodoros: 0,
  estimatedPomodoros: 1,
  subtasks: [],
  dueAt: null,
  repeat: { enabled: false, type: 'none', interval: 1 },
  completedAt: null
}
```

---

### 2.1 task/create — 创建任务

**路由**: `task/create`
**方法**: POST

#### 请求

```typescript
{
  title: string;                  // 必填，1-100 字符
  description?: string;           // 可选，最多 500 字
  priority?: TaskPriority;        // 默认 'medium'
  estimatedPomodoros?: number;    // 默认 1，范围 1-12
  subtasks?: Array<{
    title: string;                // 1-100 字符
    completed?: boolean;          // 默认 false
  }>;
  dueAt?: number | null;          // ms 时间戳或 null
  repeat?: {
    enabled?: boolean;
    type?: TaskRepeatType;        // 默认 'none'
    interval?: number;            // 默认 1，范围 1-365
  };
}
```

#### 响应

```typescript
{
  code: 0,
  data: TaskV2
}
```

#### 错误码

| code | 说明 |
|------|------|
| 400 | title 为空或超长 |
| 400 | description 超过 500 字 |
| 400 | priority 不在允许范围内 |
| 400 | estimatedPomodoros 不在 1-12 范围 |
| 400 | subtasks 超过 20 个或子任务标题非法 |
| 400 | repeat.type 不在允许范围内 |

---

### 2.2 task/list — 获取任务列表

**路由**: `task/list`
**方法**: GET

#### 请求

```typescript
{
  filter?: {
    isDone?: boolean;             // 按完成状态筛选
    priority?: TaskPriority;      // 按优先级筛选
  };
  page?: number;                  // 默认 1
  pageSize?: number;              // 默认 20，最大 100
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    tasks: TaskV2[];              // 旧数据会补齐 Task v2 默认字段
    total: number;                // 符合条件总数
    hasMore: boolean;             // 是否有下一页
  }
}
```

---

### 2.3 task/update — 更新任务

**路由**: `task/update`
**方法**: POST

#### 请求

```typescript
{
  id: string;                     // 任务 _id
  data: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    isDone: boolean;
    estimatedPomodoros: number;
    completedPomodoros: number;
    subtasks: Array<{
      id?: string;
      title: string;
      completed?: boolean;
      createdAt?: number;
      updatedAt?: number;
    }>;
    dueAt: number | null;
    repeat: {
      enabled?: boolean;
      type?: TaskRepeatType;
      interval?: number;
    };
    sortOrder: number;
  }>;
}
```

#### 行为

- 只更新 `data` 中传入的白名单字段；
- 禁止更新 `_id`、`_openid`、`createdAt`；
- `subtasks` 第一版作为整体替换；
- `isDone` 从 `false` 变 `true` 时写入 `completedAt`；
- `isDone` 从 `true` 变 `false` 时清空 `completedAt`。

#### 响应

```typescript
{
  code: 0,
  data: {
    updated: number;              // 更新的文档数（通常为 1）
  }
}
```

#### 错误码

| code | 说明 |
|------|------|
| 400 | data 不是对象或字段非法 |
| 404 | 任务不存在 |
| 403 | _openid 不匹配（无权限操作他人数据） |

---

### 2.4 task/delete — 删除任务

**路由**: `task/delete`
**方法**: POST

#### 请求

```typescript
{
  id: string;
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    deleted: number;
  }
}
```

#### 错误码

| code | 说明 |
|------|------|
| 404 | 任务不存在 |
| 403 | _openid 不匹配 |

---

## 3. Session 专注会话模块

### 3.1 session/complete — 完成一个专注会话

**路由**: `session/complete`
**方法**: POST

> 当番茄钟倒计时归零时调用，记录本次会话并更新统计数据。

#### 请求

```typescript
{
  mode: 'focus' | 'shortBreak' | 'longBreak';
  duration: number;             // 实际专注时长（秒）
  taskId?: string;              // 关联的待办任务 _id（可选）
  completedPomodoro?: boolean;  // 是否完成了一个完整的番茄（25min），默认 true
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    session: {
      _id: string;
      _openid: string;
      mode: 'focus' | 'shortBreak' | 'longBreak';
      duration: number;           // 专注时长（秒）
      startedAt: number;          // 开始时间戳
      completedAt: number;        // 结束时间戳
      taskId?: string;            // 关联任务
      isPomodoro: boolean;        // 是否计入番茄统计
      createdAt: number;
    };
    task?: {                      // 关联了 taskId 时返回更新后的任务
      _id: string;
      completedPomodoros: number;  // 已 +1
    };
    todayStats: {                 // 当日累计
      focusMinutes: number;
      pomodoroCount: number;
      completedTasks: number;
    };
  }
}
```

#### 错误码

| code | 说明 |
|------|------|
| 400 | mode 值不合法 |
| 400 | duration <= 0 |
| 404 | taskId 对应的任务不存在（非强制） |

---

### 3.2 session/list — 获取会话列表

**路由**: `session/list`
**方法**: GET

#### 请求

```typescript
{
  page?: number;                // 默认 1
  pageSize?: number;            // 默认 20
  startDate?: string;           // 起始日期 YYYY-MM-DD
  endDate?: string;             // 结束日期 YYYY-MM-DD
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    sessions: Array<{
      _id: string;
      mode: 'focus' | 'shortBreak' | 'longBreak';
      duration: number;
      startedAt: number;
      completedAt: number;
      taskId?: string;
      isPomodoro: boolean;
    }>;
    total: number;
    hasMore: boolean;
  }
}
```

---

## 4. Stats 统计模块

> 注意：统计模块不做独立 Service，直接在 routes 中调用 Repo 的聚合查询方法（查询逻辑简单，没有业务规则）。

### 4.1 stats/today — 今日统计

**路由**: `stats/today`
**方法**: GET

#### 请求

```typescript
{} // 无参数
```

#### 响应

```typescript
{
  code: 0,
  data: {
    focusMinutes: number;         // 今日专注总分钟
    pomodoroCount: number;        // 今日完成番茄数
    completedTasks: number;       // 今日完成任务数
    currentStreak: number;        // 连续专注天数
  }
}
```

---

### 4.2 stats/weekly — 本周/某周统计

**路由**: `stats/weekly`
**方法**: GET

#### 请求

```typescript
{
  weekStart?: string;            // 周一起始日期 YYYY-MM-DD，默认本周一
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    days: Array<{
      date: string;              // YYYY-MM-DD
      focusMinutes: number;
      pomodoroCount: number;
    }>;
    totalFocusMinutes: number;
    totalPomodoros: number;
  }
}
```

---

### 4.3 stats/monthly — 本月/某月统计

**路由**: `stats/monthly`
**方法**: GET

#### 请求

```typescript
{
  month?: string;                // YYYY-MM，默认本月
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    days: Array<{
      date: string;              // YYYY-MM-DD
      focusMinutes: number;
      pomodoroCount: number;
    }>;
    totalFocusMinutes: number;
    totalPomodoros: number;
  }
}
```

---

### 4.4 stats/heatmap — 年度热力图数据

**路由**: `stats/heatmap`
**方法**: GET

#### 请求

```typescript
{
  year?: number;                 // 默认当前年
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    cells: Array<{
      date: string;              // YYYY-MM-DD
      count: number;             // 当日番茄数（0 表示无数据）
    }>;
    maxCount: number;            // 当年单日最高番茄数（前端计算颜色层级用）
  }
}
```

---

## 5. Diary 日记模块

### 5.1 diary/create — 创建日记

**路由**: `diary/create`
**方法**: POST

#### 请求

```typescript
{
  content: string;               // 必填，1-2000 字符
  emotionTags?: string[];        // 情绪标签数组，最多 5 个
                                 // 可选值: '开心' | '平静' | '焦虑' | '疲惫' | '沮丧' | '兴奋' | '无聊'
  tasks?: string[];              // 关联的任务 _id 列表
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    _id: string;
    _openid: string;
    content: string;
    emotionTags: string[];
    tasks: string[];
    createdAt: number;
    updatedAt: number;
  }
}
```

---

### 5.2 diary/list — 获取日记列表

**路由**: `diary/list`
**方法**: GET

#### 请求

```typescript
{
  page?: number;                // 默认 1
  pageSize?: number;            // 默认 20
  date?: string;                // 按日期筛选 YYYY-MM-DD
  emotionTag?: string;          // 按情绪标签筛选
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    diaries: Array<{
      _id: string;
      content: string;
      emotionTags: string[];
      tasks: string[];
      createdAt: number;
      updatedAt: number;
    }>;
    total: number;
    hasMore: boolean;
  }
}
```

---

### 5.3 diary/update — 更新日记

**路由**: `diary/update`
**方法**: POST

#### 请求

```typescript
{
  id: string;
  data: {
    content?: string;
    emotionTags?: string[];
    tasks?: string[];
  };
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    updated: number;
  }
}
```

---

### 5.4 diary/delete — 删除日记

**路由**: `diary/delete`
**方法**: POST

#### 请求

```typescript
{
  id: string;
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    deleted: number;
  }
}
```

#### 错误码（diary 模块）

| code | 说明 |
|------|------|
| 400 | content 为空或超长 |
| 400 | emotionTags 超过 5 个或包含非法值 |
| 404 | 日记不存在 |
| 403 | _openid 不匹配 |

---

## 6. User 用户模块

用户模块采用静默身份登录：前端不传 openid，服务端通过 `wx-server-sdk` 的
`cloud.getWXContext().OPENID` 获取可信身份，并将用户文档固定存储为
`users/{OPENID}`。首次登录默认 `nickName` 为 `微信用户`，头像昵称后续通过
`button[open-type=chooseAvatar]` 与 `input[type=nickname]` 主动完善。

### 6.1 user/login — 静默登录/注册

**路由**: `user/login`
**方法**: POST

#### 请求

```typescript
{
  code?: string; // 兼容旧前端，可传但服务端不依赖；身份以 cloud.getWXContext().OPENID 为准
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    openid: string;
    user: {
      _id: string;        // 固定等于 OPENID
      openid: string;
      nickName: string;   // 首次默认为“微信用户”
      avatarUrl: string;
      createdAt: number;
      updatedAt: number;
    };
  };
}
```

#### 错误码

| code | 说明 |
|------|------|
| 401 | 云函数上下文无法获取 OPENID |

---

### 6.2 user/info — 获取用户信息

**路由**: `user/info`
**方法**: GET

#### 请求

```typescript
{} // 无参数，通过鉴权中间件注入 ctx.OPENID
```

#### 响应

```typescript
{
  code: 0,
  data: {
    _id: string;
    openid: string;
    nickName: string;
    avatarUrl: string;
    createdAt: number;
    updatedAt: number;
  };
}
```

---

### 6.3 user/profile/update — 更新头像昵称

**路由**: `user/profile/update`
**方法**: POST

#### 请求

```typescript
{
  nickName?: string;  // type="nickname" 主动输入/选择，服务端 trim 后最长 20 字符
  avatarUrl?: string; // chooseAvatar 上传云存储后的 cloud:// 或 https:// 地址，最长 500 字符
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    _id: string;
    openid: string;
    nickName: string;
    avatarUrl: string;
    createdAt: number;
    updatedAt: number;
  };
}
```

---

### 6.4 user/settings/get — 获取用户设置

**路由**: `user/settings/get`
**方法**: GET

#### 请求

```typescript
{} // 无参数
```

#### 响应

```typescript
{
  code: 0,
  data: {
    focusDuration: number; // 默认 25（分钟）
    shortBreak: number;    // 默认 5（分钟）
    longBreak: number;     // 默认 15（分钟）
    dailyGoal: number;     // 默认 4（番茄数）
  };
}
```

---

### 6.5 user/settings/update — 更新用户设置

**路由**: `user/settings/update`
**方法**: POST

#### 请求

```typescript
{
  settings: {
    focusDuration?: number;
    shortBreak?: number;
    longBreak?: number;
    dailyGoal?: number;
  };
}
```

#### 响应

```typescript
{
  code: 0,
  data: {
    focusDuration: number;
    shortBreak: number;
    longBreak: number;
    dailyGoal: number;
  };
}
```

---

## 7. Coach AI 教练模块

### 7.1 coach/score — 获取 AI 评分与洞察

**路由**: `coach/score`
**方法**: GET

#### 请求

```typescript
{} // 无参数，基于用户历史数据计算
```

#### 响应

```typescript
{
  code: 0,
  data: {
    score: number;                // 0-100 综合评分
    level: string;                // '新手' | '入门' | '进阶' | '达人' | '大师'
    insights: Array<{
      type: 'achievement' | 'improvement' | 'trend' | 'tip';
      icon: string;               // emoji 图标
      text: string;               // 中文描述
      value?: string;             // 指标值（可选）
    }>;
    updatedAt: number;            // 数据更新时间
  }
}
```

---

### 7.2 coach/tip — 获取今日建议

**路由**: `coach/tip`
**方法**: GET

#### 请求

```typescript
{} // 无参数
```

#### 响应

```typescript
{
  code: 0,
  data: {
    tip: string;                  // 今日建议文案
    context: {                    // 上下文数据（tip 的依据）
      todayPomodoros: number;
      weeklyAverage: number;
      lastSessionDate?: string;
    };
  }
}
```

---

## 附录 A: 数据库集合设计

| 集合名 | 说明 | 索引建议 |
|--------|------|----------|
| `tasks` | 待办任务 | `_openid` + `isDone` |
| `sessions` | 专注会话记录 | `_openid` + `completedAt` |
| `daily_summaries` | 日汇总（定时/实时更新） | `_openid` + `date` |
| `diaries` | 日记 | `_openid` + `createdAt` |
| `users` | 用户/设置 | `_openid`（唯一） |

### 集合字段定义

#### `tasks`

```typescript
{
  _id: string;
  _openid: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  isDone: boolean;
  completedPomodoros: number;
  estimatedPomodoros: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}
```

#### `sessions`

```typescript
{
  _id: string;
  _openid: string;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  duration: number;             // 秒
  startedAt: number;
  completedAt: number;
  taskId?: string;
  isPomodoro: boolean;
  createdAt: number;
}
```

#### `daily_summaries`

```typescript
{
  _id: string;
  _openid: string;
  date: string;                 // YYYY-MM-DD
  focusMinutes: number;
  pomodoroCount: number;
  completedTasks: number;
  updatedAt: number;
}
```

#### `diaries`

```typescript
{
  _id: string;
  _openid: string;
  content: string;
  emotionTags: string[];
  tasks: string[];
  createdAt: number;
  updatedAt: number;
}
```

#### `users`

```typescript
{
  _id: string;
  _openid: string;              // 唯一
  nickName?: string;
  avatarUrl?: string;
  settings: {
    sound: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    dailyGoal: number;
  };
  stats: {
    totalPomodoros: number;
    currentStreak: number;
    longestStreak: number;
  };
  createdAt: number;
  updatedAt: number;
}
```

---

## 附录 B: 版本记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-07-04 | 初版定稿：涵盖 Task / Session / Stats / Diary / User / Coach 所有接口 |

---
