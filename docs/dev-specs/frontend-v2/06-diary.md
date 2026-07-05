# 06-diary — Diary 页真实日记 + 今日任务摘要对接

## 依赖

必须在以下 spec 完成后执行：

- `01-api-foundation.md`
- `03-todo.md`
- `04-focus-session.md`

原因：Diary 页除了日记 CRUD，还需要展示今日已完成任务摘要，而任务与 session 数据由前面闭环产生。

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/diary/diary.js` | 日记列表、保存、今日任务摘要真实化 |

不要修改 WXML/WXSS，除非当前绑定字段无法满足数据展示。

---

## 当前问题

当前 Diary 页：

- `TODAY_TASKS` 仍是 mock
- historyEntries 已调用 diaryAPI，但字段映射散落在页面中
- onHistoryTap 只是 toast，没有加载详情
- onSave 保存后没有关联今日任务/专注数据

---

## 必须引入

```javascript
const diaryAPI = require('../../miniprogram/api/diary.api');
const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const { mapDiaryToView } = require('../../miniprogram/api/mappers');
```

---

## data 必须包含

```javascript
loading: false,
todayTasks: [],
historyEntries: [],
todayStats: null,
```

---

## 必须删除/替换

删除或不再使用：

```javascript
const TODAY_TASKS = [...]
```

---

## 必须实现方法

### `_loadEntries()`

1. 调 `diaryAPI.list({ pageSize: 50 })`
2. 使用 `mapDiaryToView` 映射
3. 写入 `historyEntries`
4. 失败 toast：`日记加载失败`

### `_loadTodaySummary()`

并行调用：

```javascript
const [tasksRes, statsRes] = await Promise.all([
  taskAPI.list({ isDone: true }, 1, 20),
  statsAPI.today(),
]);
```

构建 `todayTasks`：

```javascript
(tasksRes.data.tasks || []).slice(0, 3).map(t => ({
  id: t._id,
  text: t.title,
  duration: Math.round((t.completedPomodoros || 0) * 25),
  completed: true,
}))
```

`todayStats = statsRes.data`

### `onLoad()`

在设置 todayDate 和 currentPrompt 后：

```javascript
await Promise.all([
  this._loadEntries(),
  this._loadTodaySummary(),
]);
```

### `onSave()`

保存时：

```javascript
diaryAPI.create(
  this.data.currentPrompt,
  this.data.content,
  this.data.selectedEmotion,
  []
)
```

成功后：

- 清空 content/charCount
- reload entries
- 不要只 toast 不刷新

### `onHistoryTap(e)`

最小实现：

- 通过 id 找到本地 historyEntries 中的项
- 如果找到，toast 展示其 title 或 preview
- 不要求打开详情页（MVP 后续）

---

## 禁止

- 禁止继续用 `TODAY_TASKS` mock 常量
- 禁止字段映射直接写在 `_loadEntries` 中，必须用 `mapDiaryToView`
- 禁止保存成功后不刷新列表
- 禁止 API 失败静默吞错

---

## 验收检查

- [ ] diary.js 引入 `taskAPI` 和 `statsAPI`
- [ ] `TODAY_TASKS` 不再被使用
- [ ] 今日任务摘要来自 `taskAPI.list({ isDone: true })`
- [ ] 今日统计来自 `statsAPI.today()`
- [ ] 日记列表使用 `mapDiaryToView`
- [ ] 保存后刷新列表
- [ ] 失败时有 toast
