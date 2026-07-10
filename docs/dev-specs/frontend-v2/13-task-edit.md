# Task v3 — 任务编辑 + 子任务可操作

> 状态: 🚧 设计就绪，待开发  
> 日期: 2026-07-10  
> 范围: `pages/todo/todo.wxml`, `pages/todo/todo.wxss`, `pages/todo/todo.js`  
> 上游契约: `docs/api-contracts.md` §2

---

## 1. 背景

当前 Task 页面支持「创建 → toggle 完成 → 滑动删除」，但**缺乏编辑能力**：

- 任务创建后无法修改标题、描述、优先级、番茄数等字段
- 子任务只读显示 `"子任务 1/3"`，不可勾选、不可编辑文字
- 唯一流向：创建 → 完成或删除，是一条"不归路"

<!-- 选型推导: 2026-07-10 与用户 grill-me-docs 对齐后确定方案 A → 见 docs/adr/  -->

---

## 2. 目标

1. **点击内容区打开编辑弹窗** — 区分勾选框（toggle 完成）与内容区（编辑）
2. **编辑弹窗复用现有 task-sheet** — 预填现有数据，支持修改所有 Task v2 字段
3. **子任务可交互** — 在弹窗内可勾选/编辑/增删子任务，**即时保存**
4. **顶部完成状态切换** — 弹窗头部的完成开关，可随时切换任务 isDone
5. **未保存提醒** — 编辑字段后关闭弹窗时，有脏数据检测

---

## 3. 交互设计

### 3.1 任务卡片分区点击

```
┌──────────────────────────────────────────────┐
│ [○]  复习高数第二章               · 高         │
│      今天把第三章也看完                       │
│      截止: 今天 18:00  ·  🍅 0/2             │
└──────────────────────────────────────────────┘
   ↑ 勾选框                      ↑ 内容区
   catchtap="onCheckboxTap"      catchtap="onContentTap"
   → toggle 完成                 → 打开编辑弹窗
```

**勾选框** — `catchtap` 阻止冒泡，功能：切换 `isDone`，更新 UI，**不触发编辑弹窗**。

**内容区**（标题 + 描述 + 元信息行 + 优先级 badge）— `catchtap` 阻止冒泡，功能：打开编辑弹窗。

**滑动删除保持不变** — 左右滑动（`onTouchStart/Move/End`）手势监测不变；`absSwipe > 80` 触发删除飞出动画。

### 3.2 编辑弹窗布局

新建弹窗与编辑弹窗共用 `<task-sheet>`，通过 `isEditing` 标志区分：

#### 新建模式（现有，不变）

```
┌─────────────────────────────────────┐
│  ⬤ ──────── ✕                       │
│                                     │
│  新建任务                            │
│  把任务规划清楚，再开始专注            │
│                                     │
│  [字段列表...]                       │
│                                     │
│  [取消]          [保存任务]          │
└─────────────────────────────────────┘
```

#### 编辑模式（新增）

```
┌─────────────────────────────────────┐
│  ⬤ ──────── ✕                       │
│                                     │
│  ✅ 已完成                    ← 点击切换 │
│  编辑任务                            │
│                                     │
│  [字段列表...]                       │
│                                     │
│  [取消]          [保存修改]          │
└─────────────────────────────────────┘
```

**完成状态切换**（顶部）：
- 展示当前完成状态：`✅ 已完成` / `⬜ 进行中`
- 点击切换 `taskForm._completionToggle` 状态
- 与"保存修改"按钮联动：最终保存时一起提交 `isDone`

### 3.3 子任务区域（编辑模式下可操作）

```
┌──────────────────────────────────────┐
│  ⬤ 拆分子任务             [开关]      │
│    ☑️ 看微分中值定理         ✕       │
│    ☐ 做完型型练习题         ✕       │
│    ☐ 背公式卡片             ✕       │
│    + 添加步骤                        │
└──────────────────────────────────────┘
```

- **☐/☑️ 点击** → 即时切换子任务 `completed`，**调用 `taskAPI.update` 立即保存**（不依赖"保存修改"）
- **✕ 点击** → 即时删除该子任务，**立即保存**
- **子任务文字点击编辑** → 可修改子任务标题内容
- **+ 添加步骤** → 新增空子任务行，**立即保存**

> 子任务即时保存的原因：子任务是原子操作单元，用户勾选/增删后期望立即生效，不需要再点"保存修改"。

### 3.4 脏数据检测

- 打开编辑弹窗时，记录所有字段的**原始快照**（`_originalFormSnapshot`）
- 任何字段变更 → 标记 `_isDirty = true`
- 关闭弹窗时：
  - 无变更（`_isDirty === false`）→ 直接关闭
  - 有变更（`_isDirty === true`）→ `wx.showModal` 提示"有未保存的修改，确定放弃吗？"
  - 确认 → 关闭
  - 取消 → 保持弹窗打开

---

## 4. BDD 场景

```gherkin
Feature: 任务编辑与子任务操作
  As a 用户
  I want to 编辑已创建的任务和操作子任务
  So that 任务全生命周期可管理

  Background:
    Given 我打开待办页面
    And 我有一个已创建的任务 "复习高数", 优先级 medium, 预计 2 个番茄

  # ─── 进入编辑 ───

  Scenario: 点击内容区打开编辑弹窗
    When 我点击任务卡片的内容区
    Then 应打开底部编辑弹窗
    And 弹窗标题显示"编辑任务"
    And 弹窗中预填任务的现有标题 "复习高数"
    And 弹窗中预填优先级 "中"
    And 弹窗中预填预计番茄 "🍅 2"

  Scenario: 点击勾选框不打开编辑弹窗
    When 我点击任务卡片的勾选框
    Then 任务完成状态应切换
    And 不应打开编辑弹窗

  # ─── 字段编辑 ───

  Scenario: 修改任务标题并保存
    When 我打开编辑弹窗
    And 我将标题修改为 "复习高数第二章"
    And 我点击"保存修改"
    Then 任务标题应更新为 "复习高数第二章"
    And 编辑弹窗应关闭
    And 任务列表应显示新标题

  Scenario: 修改优先级并保存
    When 我打开编辑弹窗
    And 我将优先级从"中"改为"高"
    And 我点击"保存修改"
    Then 任务的优先级应更新为 high
    And 任务卡片的优先级 badge 应显示"高"

  Scenario: 修改多个字段一次性保存
    When 我打开编辑弹窗
    And 我修改标题为 "复习线代"
    And 我将预计番茄从 2 改为 3
    And 我点击"保存修改"
    Then 任务标题应更新为 "复习线代"
    And 任务预计番茄应更新为 3
    And 仅调用一次 task/update API

  # ─── 完成状态切换 ───

  Scenario: 在编辑弹窗中标记完成
    When 我打开编辑弹窗
    And 我点击顶部的完成状态切换
    And 我点击"保存修改"
    Then 任务 isDone 应变为 true
    And 任务卡片应显示完成样式（划线 + 绿色勾选框）

  Scenario: 在编辑弹窗中取消完成
    Given 任务已完成
    When 我打开编辑弹窗
    And 我点击顶部的完成状态切换（从已完成切回进行中）
    And 我点击"保存修改"
    Then 任务 isDone 应变为 false
    And 任务卡片应恢复未完成样式

  # ─── 子任务操作（即时保存） ───

  Scenario: 在编辑弹窗中勾选子任务
    Given 任务有子任务 ["看视频", "做题", "复盘"]
    When 我打开编辑弹窗
    And 我点击子任务 "看视频" 的勾选框将其标记为完成
    Then 应即时调用 task/update API
    And 子任务进度显示应更新为 "子任务 1/3"
    When 我关闭编辑弹窗
    Then 任务卡片上的元信息应显示 "子任务 1/3"

  Scenario: 在编辑弹窗中新增子任务
    When 我打开编辑弹窗
    And 我点击"+ 添加步骤"
    And 我输入 "背公式"
    Then 应即时调用 task/update API
    And 子任务列表应包含 "背公式"

  Scenario: 在编辑弹窗中删除子任务
    Given 任务有子任务 ["看视频", "做题"]
    When 我打开编辑弹窗
    And 我点击子任务 "看视频" 的 ✕
    Then 应即时调用 task/update API
    And 子任务列表应只剩 ["做题"]

  Scenario: 修改子任务标题
    Given 任务有子任务 ["看视频"]
    When 我打开编辑弹窗
    And 我将子任务标题改为 "看基础概念视频"
    And 我点击"保存修改"
    Then 子任务标题应更新为 "看基础概念视频"

  # ─── 脏数据检测 ───

  Scenario: 无修改时关闭弹窗
    When 我打开编辑弹窗
    And 我不做任何修改
    And 我点击遮罩层或 ✕ 关闭
    Then 弹窗应直接关闭
    And 不应弹出确认框

  Scenario: 有修改未保存时关闭弹窗
    When 我打开编辑弹窗
    And 我修改了标题
    And 我点击 ✕ 关闭
    Then 应弹出提示 "有未保存的修改，确定放弃吗？"
    When 我点击"确定"
    Then 弹窗关闭
    And 任务数据未变更
    When 我再次打开编辑弹窗
    Then 标题应恢复为修改前的原始值

  Scenario: 有修改未保存时点击取消按钮
    When 我打开编辑弹窗
    And 我修改了标题
    And 我点击"取消"按钮
    Then 应弹出提示 "有未保存的修改，确定放弃吗？"
    When 我点击"取消"（保持弹窗）
    Then 弹窗应保持打开
    And 我的修改仍在

  # ─── 滑动删除不变 ───

  Scenario: 滑动删除不受影响
    When 我在任务卡片上向左滑动超过 80px
    Then 任务应飞出并删除
    And 不应打开编辑弹窗
```

---

## 5. 逻辑设计

### 5.1 点击分区

| 元素 | 事件 | 处理函数 | 行为 |
|------|------|---------|------|
| 勾选框 (`.task-checkbox`) | `catchtap` | `onCheckboxTap` | `_toggleTaskById(id)` |
| 内容区 (`.task-content`) | `catchtap` | `onContentTap` | `_openEditModal(id)` |
| 滑动背景 (`.swipe-foreground`) | `touchstart/move/end` | 原有手势处理 | 仅保留 `absSwipe > 80` 删除逻辑；`absSwipe < 10` 分支改为仅重置状态（不再 trigger toggle） |

### 5.2 编辑弹窗数据流

```
编辑弹窗打开：
  task.id → tasks.find(id)
    → 转换为 taskForm 格式：
      title, description, priority, estimatedPomodoros
      enableSubtasks=true, subtasks=[...]  (if has subtasks)
      enableDue=true, dueDate/dueTime       (if has dueAt)
      enableRepeat=true, repeatType         (if repeat.enabled)
  → 保存原始快照 this._originalFormSnapshot = JSON.stringify(taskForm)
  → isEditing=true, editingTaskId=id, showTaskModal=true

保存流程：
  if (isEditing) {
    await taskAPI.update(editingTaskId, {
      title, description, priority, estimatedPomodoros,
      subtasks, dueAt, repeat
    })
  } else {
    await taskAPI.create(payload)  // 现有逻辑不变
  }
  → 关闭弹窗，刷新任务列表
```

### 5.3 子任务即时保存

子任务变更不走"保存修改"按钮，直接调用 API：

```
子任务勾选/增删 → 构建新的 subtasks 数组
  → await taskAPI.update(id, { subtasks: newSubtasks })
  → 更新本地 taskForm.subtasks（同步 UI）
  → 不关闭弹窗
```

### 5.4 脏数据检测

```
_originalFormSnapshot（打开时快照）

变更判定：
  JSON.stringify(current taskForm) !== this._originalFormSnapshot

  → 注意忽略 _completionToggle 等 UI-only 字段
  → 子任务即时保存后，同步更新快照（因为已存到后端）

关闭时：
  if (_isDirty) → wx.showModal({ title: '放弃修改？', ... })
  else → 直接关闭
```

---

## 6. 非目标

- 不修改后端 API（`task/update` 已支持全字段更新）
- 不修改 `task.api.js` 和 `mappers.js`
- 不添加新页面或新组件
- 不改变新建任务的流程和弹窗
- 不改变滑动删除的手势逻辑

---

## 7. 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/todo/todo.wxml` | 添加 `catchtap` 事件绑定；弹窗标题/按钮条件；编辑模式下的完成状态切换 UI |
| `pages/todo/todo.js` | 点击分区处理函数、编辑弹窗数据流、子任务即时保存、脏数据检测 |
| `pages/todo/todo.wxss` | 编辑弹窗头部完成状态切换的样式（可选） |
