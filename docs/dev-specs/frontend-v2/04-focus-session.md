# 04-focus-session — Focus 页真实任务选择 + Session 写入闭环

## 依赖

必须在以下 spec 完成后执行：

- `01-api-foundation.md`
- `03-todo.md`

原因：Focus 页需要读取真实 Task 列表，并把完成 session 关联到真实 taskId。

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/focus/focus.js` | 真实任务选择、session/complete、今日统计刷新 |

如当前 WXML 没有任务选择面板，可以**允许轻微修改 `pages/focus/focus.wxml` 和 `pages/focus/focus.wxss`** 添加底部任务选择弹层。但不得重写整页布局。

---

## 当前问题

当前 focus 页：

1. `currentTask` 是固定 mock：`📖 复习高数第三章`
2. 完成 session 时 `taskId: null`
3. `_loadTodayStats()` 只是调用 `sessionAPI.list`，没有真正更新统计
4. 没有从 taskAPI 读取可选任务

---

## 必须引入

```javascript
const sessionAPI = require('../../miniprogram/api/session.api');
const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const { mapTaskToView, formatDuration } = require('../../miniprogram/api/mappers');
```

---

## data 必须新增/调整

```javascript
availableTasks: [],
selectedTaskId: '',
currentTask: '',
showTaskPicker: false,
todayStats: null,
```

`currentTask` 不再写死。

---

## 必须实现方法

### `_loadAvailableTasks()`

行为：

1. 调 `taskAPI.list({ isDone: false }, 1, 100)`
2. 映射 `res.data.tasks.map(mapTaskToView)`
3. 写入 `availableTasks`
4. 如果当前 `selectedTaskId` 不存在且列表非空，默认选第一个任务

### `_loadTodayStats()`

行为：

1. 调 `statsAPI.today()`
2. 成功后构建 `statItems`：
```javascript
[
  { label: '今日专注', value: formatDuration(res.data.focusMinutes || 0), icon: '⏱️' },
  { label: '今日番茄', value: `${res.data.pomodoroCount || 0} 个`, icon: '🍅' },
]
```
3. 同步 `sessions = res.data.pomodoroCount || 0`

### `onTaskPickerOpen()`

- 调 `_loadAvailableTasks()`
- `showTaskPicker=true`

### `onTaskSelect(e)`

- 从 dataset 取 id
- 找到任务
- 设置：
```javascript
selectedTaskId: task.id,
currentTask: task.text,
showTaskPicker: false,
```

### `start()` 改造

在开始专注前：

- 如果 mode === 'focus' 且没有 selectedTaskId：
  - 先打开任务选择器
  - toast：`请先选择一个待办任务`
  - return
- 如果已选任务，正常开始计时

### 计时完成逻辑改造

当 focus 计时完成时，调用：

```javascript
await sessionAPI.complete('focus', DURATIONS.focus, {
  taskId: this.data.selectedTaskId || null,
  completedPomodoro: true,
});
```

成功后：

1. 调 `_loadTodayStats()`
2. 调 `_loadAvailableTasks()`（因为 task 进度可能改变）
3. 保持原来的震动/提示逻辑

短休息完成时也可调用 sessionAPI.complete，但 `completedPomodoro=false`。

---

## WXML/WXSS 要求（如需新增）

如当前页面没有任务选择 UI，添加最小可用弹层：

- 点击当前任务区域打开 picker
- 弹层显示 `availableTasks`
- 每项显示：任务名 + `completed/pomodoros`
- 点击项触发 `onTaskSelect`
- 空状态：`暂无待办，请先去待办页添加任务`

不要重做整个 UI。

---

## 禁止

- 禁止继续使用固定 `currentTask: '📖 复习高数第三章'`
- 禁止 `sessionAPI.complete` 传 `taskId: null` 作为唯一逻辑
- 禁止 `_loadTodayStats` 空实现
- 禁止开始专注时没有任务选择逻辑

---

## 验收检查

- [ ] Focus 页引入 `taskAPI` 和 `statsAPI`
- [ ] `currentTask` 不再是固定 mock
- [ ] 能加载真实未完成任务列表
- [ ] 开始专注前会要求选择任务
- [ ] 完成番茄后 session 记录包含真实 taskId
- [ ] 完成后今日统计会刷新
- [ ] 只做最小 WXML/WXSS 改动
