# 03-todo — Todo 页真实 CRUD 对接

## 依赖

必须在 `01-api-foundation.md` 完成后执行，因为依赖：

- `miniprogram/api/task.api.js`
- `miniprogram/api/mappers.js`

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/todo/todo.js` | 真实任务列表、增删改查、下拉/筛选刷新 |

不要修改 WXML/WXSS。

---

## 当前问题

上一版虽然已经引入 `taskAPI`，但仍存在问题：

1. 页面字段映射散落在页面里，没有统一 mapper。
2. 筛选切换、删除滑动、批量删除等流程需要确认全部走后端。
3. 页面没有明确 `loading` / `error` / `empty` 状态。
4. 完成任务后没有触发其他页面刷新协议。

---

## 必须引入

```javascript
const taskAPI = require('../../miniprogram/api/task.api');
const { mapTaskToView } = require('../../miniprogram/api/mappers');
```

---

## data 必须包含

```javascript
loading: false,
errorText: '',
```

保留已有：

```javascript
tasks: [],
filter: 'all',
```

---

## 必须实现/调整的方法

### `_buildFilterParams()`

返回给后端的 filter：

```javascript
if filter === 'done'   → { isDone: true }
if filter === 'active' → { isDone: false }
if filter === 'all'    → {}
```

### `_loadTasks({ silent = false } = {})`

行为：

1. 如果 `silent === false`，`this.setData({ loading: true, errorText: '' })` 并 `wx.showLoading({ title: '加载中...' })`
2. 调 `taskAPI.list(this._buildFilterParams(), 1, 100)`
3. 成功后：
   - `const tasks = res.data.tasks.map(mapTaskToView)`
   - `this.setData({ tasks, loading: false })`
   - 调 `_updateComputed()`
4. 失败：
   - `loading=false`
   - `errorText='任务加载失败'`
   - toast
5. finally hideLoading

### `onInputSend()`

行为：

1. 取 `this.data.input.trim()`
2. 空值 return
3. 调 `taskAPI.create(text, 'medium', 1)`
4. 成功后清空 input，`await this._loadTasks({ silent: true })`
5. 失败 toast

### `onToggleDone(e)`

行为：

1. 找到 task
2. 调 `taskAPI.update(task.id, { isDone: !task.done })`
3. 成功后 reload
4. 不允许只改本地状态后不写后端

### `onDeleteTask(e)` / 滑动删除相关方法

所有删除入口都必须最终调用：

```javascript
taskAPI.delete(id)
```

并在成功后 `_loadTasks({ silent: true })`。

### `onFilterChange(e)`

1. 更新 `filter`
2. 调 `_loadTasks({ silent: true })`

---

## 禁止

- 禁止保留 `INITIAL_TASKS`
- 禁止创建任务只改本地数组
- 禁止删除任务只改本地数组
- 禁止把后端字段 `_id/title/isDone` 直接写入 WXML 绑定，必须转换为页面字段 `id/text/done`

---

## 验收检查

- [ ] `INITIAL_TASKS` 不存在
- [ ] 页面引入 `mapTaskToView`
- [ ] `taskAPI.list/create/update/delete` 均被使用
- [ ] 筛选切换会重新请求后端
- [ ] 增删改后刷新列表
- [ ] 没有修改 WXML/WXSS
