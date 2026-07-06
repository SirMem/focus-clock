# 06-diary — Diary 页真实日记 + 今日任务摘要对接（救援版）

> 状态: 🚧 需修复
> 契约来源: [`../../api-contracts.md`](../../api-contracts.md) §6
> 目标: 日记创建/列表/情绪标签与后端 `content/emotionTags/tasks` + `diaries` 契约一致。

---

## 1. 依赖

必须已完成或确认：

- `01-api-foundation.md`：`diary.api.js`, `task.api.js`, `stats.api.js`, `mappers.js`
- `03-todo.md`：Todo 已真实 CRUD
- `04-focus-session.md`：Session 完成后能更新任务和统计
- `docs/api-contracts.md`：Diary canonical contract 已冻结

---

## 2. 允许修改文件

| 文件 | 内容 |
|---|---|
| `miniprogram/api/diary.api.js` | 对齐 backend diary create/list/update/delete 参数 |
| `miniprogram/api/mappers.js` | `mapDiaryToView` 对齐 `createdAt/emotionTags/content` |
| `pages/diary/diary.js` | 日记列表、保存、今日任务摘要真实化 |
| `pages/diary/diary.wxml` | 仅在当前绑定无法展示 canonical view model 时少量修改 |
| `pages/diary/diary.wxss` | 仅在新增空态样式时少量修改 |

---

## 3. 当前问题

当前 Diary 页/封装存在契约漂移：

1. `diary.api.create(title, content, mood, tags)` 发送旧字段。
2. 后端 `diary/create` 期望 `{ content, emotionTags, tasks }`。
3. 页面 `_loadEntries()` 读取 `res.data.entries`。
4. 后端 `diary/list` 返回 `{ diaries, total, hasMore }`。
5. `mapDiaryToView` 依赖 `date/mood/title`，但后端 canonical 字段是 `createdAt/emotionTags/content`。

---

## 4. Canonical Diary 契约

### 4.1 `diary/create`

请求：

```js
{
  content: string,
  emotionTags?: string[],
  tasks?: string[]
}
```

响应：

```js
{
  _id,
  _openid,
  content,
  emotionTags,
  tasks,
  createdAt,
  updatedAt
}
```

### 4.2 `diary/list`

请求：

```js
{
  page?: number,
  pageSize?: number,
  date?: string,
  emotionTag?: string
}
```

响应：

```js
{
  diaries: Diary[],
  total: number,
  hasMore: boolean
}
```

---

## 5. 必须实现/调整

### 5.1 `miniprogram/api/diary.api.js`

建议改为对象式 API，降低参数顺序错误：

```js
create({ content, emotionTags = [], tasks = [] }) {
  return callAPI('diary/create', { content, emotionTags, tasks });
}
```

如果为了兼容旧调用，也可以临时保留 deprecated wrapper，但页面新代码必须使用 canonical 调用。

`list` 应支持：

```js
list({ page, pageSize, date, emotionTag } = {}) {
  return callAPI('diary/list', { page, pageSize, date, emotionTag });
}
```

注意：当前后端没有 `diary/get` 路由。`diary.api.get` 若保留，必须标注 P1/deprecated，P0 页面不得依赖。

### 5.2 `mapDiaryToView(entry)`

必须以 canonical 字段为主：

```js
function mapDiaryToView(entry = {}) {
  const content = entry.content || '';
  const emotionTags = Array.isArray(entry.emotionTags) ? entry.emotionTags : [];
  const createdAt = entry.createdAt;

  return {
    id: entry._id,
    date: formatDate(createdAt),
    emotion: emotionTags[0] || '平静',
    preview: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
    content,
    title: deriveTitle(createdAt, content),
  };
}
```

允许短期 fallback：

- `entry.date`
- `entry.mood`
- `entry.title`

但这些只能作为历史兼容，不是 canonical。

### 5.3 `_loadEntries()`

必须：

1. 调 `diaryAPI.list({ pageSize: 50 })`
2. 检查 `res.code === 0`
3. 读取 `res.data.diaries || []`
4. 使用 `mapDiaryToView`
5. 写入 `historyEntries`
6. 失败 toast：`日记加载失败`

禁止读取 `res.data.entries` 作为主逻辑。

### 5.4 `_loadTodaySummary()`

P0 现实约束：当前 Task 契约只有 `isDone`，没有 `completedAt/doneAt` 或“今日完成任务”筛选。因此这里展示的是**已完成任务摘要**，不是严格的“今日完成任务”。严格今日任务摘要需要 P1 扩展 Task 字段或 Stats/Session 聚合。

继续并行调用：

```js
const [tasksRes, statsRes] = await Promise.all([
  taskAPI.list({ isDone: true }, 1, 20),
  statsAPI.today(),
]);
```

要求：

- 检查响应 `code === 0`。
- `todayTasks` 来自 `tasksRes.data.tasks`，P0 文案建议称为“已完成任务摘要”。
- `todayStats` 来自 `statsRes.data`。
- 失败时至少 `console.warn` + toast 或轻量错误状态，不允许完全静默。

### 5.5 `onSave()`

保存时必须：

```js
diaryAPI.create({
  content: this.data.content,
  emotionTags: [mapEmotionToCanonical(this.data.selectedEmotion)],
  tasks: this.data.todayTasks.map(t => t.id), // 如不想关联，可传 []，但必须字段语义正确
})
```

P0 建议：

- 如果“今日任务摘要”只是展示，不想自动关联所有任务，则传 `tasks: []`。
- `selectedEmotion` 必须映射为后端支持的中文情绪标签：`开心`、`平静`、`焦虑`、`疲惫`、`沮丧`、`兴奋`、`无聊`。如果页面 UI 仍使用英文 id（如 `calm`），保存前必须转换为 `平静`。
- 不再传 `currentPrompt` 作为 `title`。如需要保存 prompt，P1 可扩展后端字段；P0 可只在 UI 显示。

成功后：

- 清空 `content` / `charCount`
- reload entries
- toast `保存成功`

---

## 6. P0 不做

- 不做图片上传。
- 不做语音输入。
- 不做日记详情页。
- 不依赖 `diary/get`。
- 不新增 `title/mood/tags` 后端字段。

---

## 7. 禁止

- 禁止继续用 `TODAY_TASKS` mock 常量。
- 禁止字段映射直接散落在 `_loadEntries()` 中，必须使用 `mapDiaryToView`。
- 禁止读取 `res.data.entries` 作为主逻辑。
- 禁止 `diaryAPI.create(title, content, mood, tags)` 作为新代码路径。
- 禁止保存成功后只 toast 不刷新列表。
- 禁止 API 失败静默吞错。

---

## 8. 验收检查

- [ ] `diary.api.create` 发送 `{ content, emotionTags, tasks }`。
- [ ] `diary.api.list` 支持 `{ page, pageSize, date, emotionTag }`。
- [ ] `mapDiaryToView` 主字段为 `createdAt/emotionTags/content`。
- [ ] `_loadEntries()` 读取 `res.data.diaries`。
- [ ] `onSave()` 把 `selectedEmotion` 写入 `emotionTags`。
- [ ] 保存后刷新历史列表。
- [ ] 已完成任务摘要来自 `taskAPI.list({ isDone: true })`；严格今日完成任务为 P1。
- [ ] 今日统计来自 `statsAPI.today()`。
- [ ] 无日记时显示空态，不报错。
- [ ] 失败时有 toast 或明确错误状态。

---

## 9. 手工验证

1. 首次进入 Diary：无数据时显示空态。
2. 输入内容，选择情绪，点击保存。
3. 保存成功后，历史列表出现新记录。
4. 退出页面再进入，记录仍可见。
5. 情绪显示与选择一致。
6. 后端返回 `diaries` 时页面不再空白。
