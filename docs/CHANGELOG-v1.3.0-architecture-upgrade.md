# 变更记录

## v1.3.0 — 架构升级：Clean Layered Architecture

> 2026-06-25

### 概述

本次架构升级将项目从「Page 层堆逻辑」的 MVP 模式，迁移至 **Clean Layered Architecture（轻量分层架构）**，为后续功能开发（日记、AI 教练、统计看板升级等）提供可扩展的基础设施。

### 架构对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 代码组织 | 所有逻辑在 Page 层，无分层 | `pages/ → store/ → services/ → lib/` 四层架构 |
| 数据存储 | 裸 `wx.setStorageSync` 散落各处 | `lib/storage.js` 统一封装，带版本控制、错误处理、配额监控 |
| 状态管理 | 无，模块间完全隔离 | `store/` 观察者模式，Page 订阅即自动同步 |
| 模块通信 | 无 | `services/eventBus.js` PubSub 解耦所有模块 |
| 数据不可变性 | `push/splice` 直接 mutation | `map/filter/...` 不可变更新 |
| 计时方案 | `setInterval` 每秒 tick，后台 5s 后节流 | 绝对时间戳驱动，后台恢复无误差 |
| 事件日志 | 简单数组，无标准格式 | EventLog append-only 事件溯源，纯函数计算统计 |
| 版本控制 | 无 | Storage key 带 `_version` 字段，支持迁移 |
| 待办模型 | `{name, completed}` | `{id, name, completed, important, urgent, pomodoros, ...}` |
| 可测试性 | 业务逻辑与 Page 强耦合 | `services/` 和 `store/` 可单独测试 |

### 新增文件（18 个）

**持久化层 `lib/`**
- `lib/storage.js` — Storage 封装（版本控制、错误处理、配额监控、数据迁移）

**状态管理层 `store/`**
- `store/base-store.js` — 观察者模式基类（订阅/通知、不可变更新辅助、安全深拷贝）
- `store/timer-store.js` — 计时器共享状态（后台恢复、EventBus 集成、EventLog 集成）
- `store/todo-store.js` — 待办共享状态（不可变 CRUD、旧数据自动迁移、四象限支持）
- `store/diary-store/index.js` — 日记共享状态（每日一记、情绪标签、自动关联番茄专注）

**业务逻辑层 `services/`**
- `services/eventBus.js` — PubSub 事件总线（全局单例、一次性订阅、自动清理）
- `services/eventLog.js` — 不可变事件溯源日志（append-only、自动清理旧数据、条件查询）
- `services/timer.js` — 绝对时间戳 PomodoroTimer 类（后台恢复、暂停/恢复、进度计算）
- `services/statistics.js` — 纯函数统计计算器（日/周/月统计、趋势数据、连续打卡天数）

**数据模型 `models/`**
- `models/task.js` — 任务数据模型（ID 生成、四象限分类）

**视图层 `pages/`（新建）**
- `pages/diary/` — 日记页面（情绪选择、反思输入、历史记录）
- `pages/ai-coach/` — AI 效率教练页面（数据概览、趋势图表、本地规则引擎建议）

### 修改的文件（7 个）

- `app.js` — 集成 TimerStore 全局初始化
- `utils/util.js` — 新增 `getTime()`、`getDateString()`、`padZero()` 工具函数
- `pages/index/index.js` — 从 `setInterval` 改为 TimerStore + EventBus 驱动渲染
- `pages/todos/todos.js` — 从直接 mutation 改为 TodoStore 不可变操作
- `pages/todos/todos.wxml` — 改用 `data-id="{{ item.id }}"` + `wx:key="id"`
- `pages/logs/logs.js` — 从裸 Storage 改为 EventLog + statistics.js 驱动
- `app.json` — 注册日记和 AI 教练页面

### 向后兼容

- 旧 `'logs'` key 保持双写，切换无感
- 旧 `'todo_list'` key 在首次加载时自动迁移到新 key
- 旧 `'todo_logs'` key 保持双写
- 所有页面 UI 保持不变，用户数据不受影响

### 下一步

- 日记模块完善（日历视图、历史检索）
- AI 教练模块完善（API 集成、深度分析）
- 统计看板升级（uCharts 趋势折线图、GitHub 风格打卡日历）
- 待办-番茄钟关联（专注时选任务、自动计次）
- 四象限视图组件
- 单元测试覆盖
