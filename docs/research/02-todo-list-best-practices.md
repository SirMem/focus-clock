# 待办清单模块 — 行业最佳实践调研报告

> 调研日期：2026-06-19
> 调研方法：Grok-4.20 多智能体搜索 + 开源项目分析
> 对应模块：`pages/todos/todos.js`

---

## 目录

1. [现有代码问题分析](#1-现有代码问题分析)
2. [开源项目参考](#2-开源项目参考)
3. [设计哲学](#3-设计哲学)
4. [架构哲学](#4-架构哲学)
5. [微信小程序生态最佳实践](#5-微信小程序生态最佳实践)
6. [推荐技术路线](#6-推荐技术路线)
7. [参考资料](#7-参考资料)

---

## 1. 现有代码问题分析

当前 `pages/todos/todos.js` 存在以下核心问题：

| 问题 | 代码位置 | 影响 |
|------|----------|------|
| **直接 Mutation** | `todos.push(...)`, `todos[index].completed = ...`, `todos.splice(index, 1)` | 破坏小程序 setData diff 机制，导致潜在渲染性能问题 |
| **数据层裸调** | `wx.setStorageSync` / `wx.getStorageSync` 直接在 Page 中调用 | 无封装、无版本控制、无错误处理 |
| **无状态管理** | 所有状态在 `this.data` 中平铺 | 模块间无法共享数据（番茄钟不认识待办） |
| **无任务模型** | 任务存为匿名对象 `{ name, completed }` | 扩展困难（无法加优先级、番茄数、标签等） |
| **无四象限** | 全部平铺列表 | 缺乏优先级管理能力 |
| **日志耦合** | 操作日志混在待办数据里一起存 | 职责不清，后续统计模块难以独立使用事件溯源 |
| **无任务-计时关联** | 待办页面与番茄钟页面完全独立 | 启动番茄时无法选择关联任务 |
| **ID 缺失** | 无唯一标识（靠数组索引） | 删除/更新依赖 index，数据不稳定 |

---

## 2. 开源项目参考

### 2.1 核心推荐项目

| 项目 | 仓库 | 亮点 | 可参考价值 |
|------|------|------|-----------|
| **smilelight/todolist** | [GitHub](https://github.com/smilelight/todolist) | MVC + Store 模式、四象限视图、进度图表、智能排序、完整 Model 层 | ⭐⭐⭐⭐⭐ |
| **realyao/WXminiprogram-Focus-clock** | [GitHub](https://github.com/realyao/WXminiprogram-Focus-clock) | 番茄钟 + 待办 + 习惯 + 统计，任务可关联计时器，自动记录专注时长 | ⭐⭐⭐⭐⭐ |
| **charleyw/wechat-weapp-redux-todos** | [GitHub](https://github.com/charleyw/wechat-weapp-redux-todos) | Redux 模式 + 不可变更新、redux-undo、redux-persist | ⭐⭐⭐⭐ |
| **lw-yang/time-helper** | [GitHub](https://github.com/lw-yang/time-helper) | 纯四象限法则实现、云开发数据库 | ⭐⭐⭐ |

### 2.2 各项目架构对比

| 维度 | smilelight/todolist | charleyw/redux-todos | realyao/focus-clock | lw-yang/time-helper |
|------|---------------------|---------------------|---------------------|---------------------|
| 状态管理 | MVC + StoreManager | Redux | Page 级 data | 云开发 DB |
| 数据层 | Model + Store | Reducer + persist | 裸 wx.setStorageSync | wx.cloud.database |
| 组件化 | 专用组件（mini-todo 等） | 无（demo 级） | WeUI 组件 | 自定义组件 |
| 四象限 | ✅ 完整实现 | ❌ | ❌ | ✅ 完整实现 |
| 与计时器关联 | ❌ | ❌ | ✅ 核心功能 | ❌ |
| 不可变更新 | ✅ Store新实例 | ✅ Reducer纯函数 | ❌ 直接 push/mutate | ✅ 云 API |
| 统计图表 | ✅ wxcharts | ❌ | ✅ wxcharts | ❌ |

---

## 3. 设计哲学

### 3.1 核心设计原则

优秀待办项目普遍遵循以下设计哲学：

#### ① 任务即核心实体（Task-Centric）

任务不是 `{name, completed}` 这样的匿名对象，而是有身份的领域实体：

```javascript
// 推荐的数据模型
{
  id: string,                // UUID，唯一标识（不可变）
  title: string,             // 任务标题
  desc: string,              // 任务描述（可选）
  important: boolean,        // 重要
  urgent: boolean,           // 紧急
  completed: boolean,        // 是否完成
  completedAt: string|null,  // 完成时间
  pomodorosPlanned: number,  // 预估番茄数
  pomodorosCompleted: number,// 实际完成番茄数
  tags: string[],            // 标签
  dueDate: string|null,      // 截止日期
  createdAt: string,         // 创建时间
  updatedAt: string          // 更新时间
}
```

**哲学：** 一个实体有自己的生命周期、行为和业务规则，而不是被动数据。四象限不是存进去的，是算出来的：

```
Q1（重要且紧急） = important && urgent
Q2（重要不紧急） = important && !urgent
Q3（紧急不重要） = !important && urgent
Q4（不重要不紧急） = !important && !urgent
```

#### ② 单向数据流（Unidirectional Data Flow）

```
用户操作 → Action/Handler → 纯函数更新 → 新 State → setData → 视图重渲染
```

优点：
- 可预测：给定输入，输出确定
- 可追踪：每个状态变更都可审计
- 可撤销：保留历史 state 快照即可实现 undo

#### ③ 数据与视图分离

Model/Store 层完全不依赖微信 API，可以在 Node 环境测试业务逻辑。Page 只做两件事：**读取状态** 和 **派发操作**。

### 3.2 四象限优先级：计算属性而非存储字段

```javascript
// todoManager.js
class TodoManager {
  static getQuadrant(task) {
    if (task.important && task.urgent) return 'Q1'  // 重要紧急 — 红色
    if (task.important && !task.urgent) return 'Q2' // 重要不紧急 — 蓝色
    if (!task.important && task.urgent) return 'Q3' // 紧急不重要 — 黄色
    return 'Q4' // 不重要不紧急 — 绿色
  }

  static filterByQuadrant(tasks, quadrant) {
    return tasks.filter(t => this.getQuadrant(t) === quadrant)
  }

  static get stats() { /* 各象限计数、完成率 */ }
}
```

**设计思想：** 象限是派生状态（derived state），不是存储状态。这避免了数据冗余和不一致。

### 3.3 任务与番茄钟的关联设计

```
┌─────────────┐     taskId     ┌─────────────┐
│   TodoList   │ ────────────→ │   Timer     │
│  (选择任务)   │               │ (启动计时)   │
└──────┬──────┘               └──────┬──────┘
       │                             │
       │  番茄完成时                  │
       ▼                             ▼
┌─────────────────────────────────────────┐
│           pomodoroService               │
│  task.pomodorosCompleted += 1           │
│  pomodoroLogs.push({taskId, duration})  │
│  statsService.aggregate()               │
└─────────────────────────────────────────┘
```

**哲学：** 待办不是孤岛，它是番茄工作法的"计划层"。任务决定做什么，番茄钟决定做多久，统计决定做得怎么样。三者通过统一的 `taskId` 关联。

---

## 4. 架构哲学

### 4.1 分层架构

```
┌─────────────────────────────────────────┐
│          View Layer (WXML)              │
│  TodoList / QuadrantView / TodoItem     │
├─────────────────────────────────────────┤
│      Controller Layer (Page/Comp)       │
│  事件处理 → 调用 Service → setData      │
├─────────────────────────────────────────┤
│        Service Layer (Manager)          │
│  todoManager / pomodoroService /        │
│  statsService / eventBus                │
├─────────────────────────────────────────┤
│         Store Layer (Data)              │
│  TodoStore / LogStore / Storage         │
│  封装 wx.setStorage / wx.getStorage     │
├─────────────────────────────────────────┤
│         Model Layer (Entity)            │
│  Task / PomodoroLog / Tag               │
└─────────────────────────────────────────┘
```

### 4.2 数据层封装方案

**不推荐（当前做法）：**
```javascript
// 到处散落的 wx.setStorageSync
wx.setStorageSync('todo_list', this.data.todos)
```

**推荐（Store 模式 + smilelight 风格）：**

```javascript
// stores/BaseStore.js
class BaseStore {
  constructor(key, defaultValue) {
    this.key = key
    this.data = defaultValue
    this.version = 1  // 数据版本，用于迁移
  }

  load() {
    try {
      const raw = wx.getStorageSync(this.key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.version === this.version) {
          this.data = parsed.data
        } else {
          this.migrate(parsed)
        }
      }
    } catch (e) {
      console.error(`[Store] Failed to load ${this.key}`, e)
    }
    return this.data
  }

  save() {
    wx.setStorageSync(this.key, {
      version: this.version,
      data: this.data,
      updatedAt: new Date().toISOString()
    })
  }

  // 版本迁移钩子（子类重写）
  migrate(oldData) { /* */ }
}
```

```javascript
// stores/TodoStore.js
class TodoStore extends BaseStore {
  constructor() {
    super('todos', [])
  }

  // 不可变更新：返回新数组
  add(task) {
    this.data = [...this.data, { ...task, id: generateId(), createdAt: now() }]
    this.save()
    return task
  }

  update(id, changes) {
    this.data = this.data.map(t =>
      t.id === id ? { ...t, ...changes, updatedAt: now() } : t
    )
    this.save()
  }

  remove(id) {
    this.data = this.data.filter(t => t.id !== id)
    this.save()
  }

  toggle(id) {
    this.data = this.data.map(t =>
      t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? now() : null, updatedAt: now() } : t
    )
    this.save()
  }

  getById(id) {
    return this.data.find(t => t.id === id)
  }

  // 派生查询
  getByQuadrant(q) { /* filter by important/urgent */ }
  get incomplete() { return this.data.filter(t => !t.completed) }
  get completed() { return this.data.filter(t => t.completed) }
}
```

### 4.3 模块间通信模式

推荐 **EventBus + Service 层** 模式：

```javascript
// services/eventBus.js
class EventBus {
  constructor() {
    this._listeners = {}
  }

  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn)
    return () => this.off(event, fn)  // 返回取消订阅函数
  }

  off(event, fn) {
    const fns = this._listeners[event]
    if (fns) this._listeners[event] = fns.filter(f => f !== fn)
  }

  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data))
  }
}

// app.js
const app = getApp()
app.eventBus = new EventBus()

// 待办模块：任务完成时发布事件
app.eventBus.emit('task:completed', { taskId, duration })

// 统计模块：订阅事件
app.eventBus.emit('task:completed', ({ taskId, duration }) => {
  statsService.record({ taskId, duration })
})
```

关键事件设计：

| 事件 | 发布者 | 订阅者 | 数据 |
|------|--------|--------|------|
| `task:completed` | 待办 | 统计 | `{ taskId }` |
| `pomodoro:complete` | 番茄钟 | 待办、统计 | `{ taskId, duration }` |
| `pomodoro:start` | 番茄钟 | 待办 | `{ taskId }` |
| `stats:updated` | 统计 | 所有页面 | `{ ... }` |
| `data:reset` | 设置 | 所有模块 | — |

### 4.4 不可变数据模式：三种实现方案

| 方案 | 代码 | 适用场景 |
|------|------|---------|
| **Spread + map/filter** | `[...arr]`, `arr.map(x => ...x)`, `arr.filter(...)` | 原生小程序，推荐 |
| **JSON 序列化** | `JSON.parse(JSON.stringify(data))` | 深拷贝后备方案 |
| **immer** | `produce(state, draft => { ... })` | Taro 等现代框架 |

**原生推荐方案：**

```javascript
// ❌ 直接 Mutation（当前做法）
todos.push(newItem)
todos[index].completed = true

// ✅ 不可变更新（推荐做法）
addTask(tasks, newTask) {
  return [...tasks, { ...newTask, id: generateId() }]
}

toggleTask(tasks, id) {
  return tasks.map(t =>
    t.id === id ? { ...t, completed: !t.completed } : t
  )
}

removeTask(tasks, id) {
  return tasks.filter(t => t.id !== id)
}

updateTask(tasks, id, changes) {
  return tasks.map(t =>
    t.id === id ? { ...t, ...changes, updatedAt: now() } : t
  )
}
```

---

## 5. 微信小程序生态最佳实践

### 5.1 setData 优化

```javascript
// ❌ 差：全量传输
this.setData({ todos: newTodos })

// ✅ 好：精确路径 + 批量
this.setData({
  'todos[3].completed': true,
  leftCount: this.data.leftCount - 1
})

// ✅ 更好：setData 合并 + 防抖
import { debounce } from '../utils/util'
const setDataDebounced = debounce(this.setData.bind(this), 16)
```

### 5.2 列表渲染性能

```
wx:for + wx:key="{{item.id}}"  // 必须用唯一 ID，不要用 index
```

- 四象限拆分 4 个独立列表组件（每个象限一个 `<todo-list>` 组件）
- 避免 wxml 中的 `computed` 逻辑（移到 JS 侧预处理）
- 长列表虚拟滚动（超过 50 条时考虑）

### 5.3 Storage 封装要点

- 异步优先 `wx.getStorage`（同步版会阻塞渲染）
- 版本号用于数据迁移
- JSON 序列化统一管理
- 配额监控（单个 key 不超过 1MB）

---

## 6. 推荐技术路线

### 短期修复（不改架构）

1. **加 UUID**：任务增加 `id` 字段，所有增删改用 ID 而非 index
2. **不可变更新**：`push` → `[...]`, `splice` → `filter`
3. **分离日志**：todo_logs 独立存储，为统计模块铺路

### 中期重构（建议架构）

```
src/
├── models/
│   └── Task.js            # 任务数据模型 + 工厂函数
├── stores/
│   ├── BaseStore.js       # 存储基类（版本控制、序列化）
│   ├── TodoStore.js       # 待办数据存储
│   └── LogStore.js        # 操作日志存储（事件溯源基础）
├── services/
│   ├── todoManager.js     # 业务逻辑（四象限、排序、筛选）
│   ├── eventBus.js        # 模块间通信总线
│   └── pomodoroService.js # 番茄钟-待办关联服务
├── components/
│   ├── todo-item/         # 单条待办组件（滑动、切换、删除）
│   └── quadrant-view/     # 四象限视图组件
└── pages/
    └── todos/
        ├── todos.js       # 控制器（瘦：只做调度）
        ├── todos.wxml     # 视图（只渲染）
        └── todos.wxss     # 样式
```

### 长期演进

- 接入统计模块的事件溯源（Event Sourcing）
- 接入 AI 教练模块的任务智能排序
- 考虑 MobX/mini-store 等状态管理方案（见 [04-state-management.md](./04-state-management.md)）

---

## 7. 参考资料

1. [smilelight/todolist](https://github.com/smilelight/todolist) — 四象限 + Store 模式参考
2. [realyao/WXminiprogram-Focus-clock](https://github.com/realyao/WXminiprogram-Focus-clock) — 番茄钟+待办关联参考
3. [charleyw/wechat-weapp-redux-todos](https://github.com/charleyw/wechat-weapp-redux-todos) — Redux + 不可变模式参考
4. [lw-yang/time-helper](https://github.com/lw-yang/time-helper) — 四象限独立实现参考
5. [justjavac/awesome-wechat-weapp](https://github.com/justjavac/awesome-wechat-weapp) — 微信小程序开源项目汇总
