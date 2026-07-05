# 01-api-foundation — 前端 API 基础设施

## 目标

先补齐所有页面共用的 API 基础能力，避免每个页面重复处理登录失效、错误提示、字段映射。

## 允许修改文件

| 操作 | 文件 |
|------|------|
| 修改 | `miniprogram/api/request.js` |
| 创建 | `miniprogram/api/stats.api.js` |
| 创建 | `miniprogram/api/mappers.js` |
| 创建 | `miniprogram/api/auth.js` |

不要修改任何页面文件。

---

## 1. 修改 `miniprogram/api/request.js`

当前 `callAPI(url, data)` 只返回 `res.result`，缺少统一错误处理。

### 要求

保留 `callAPI` 函数名，但扩展能力：

```javascript
function callAPI(url, data = {}, options = {})
```

### 行为

1. 调用 `wx.cloud.callFunction({ name: 'focus-api', data: { $url: url, ...data } })`
2. 读取 `res.result`
3. 如果 result 不存在，返回 `{ code: -1, message: '接口无响应' }`
4. 如果 `result.code === 401`：
   - 清理本地登录态：`openid`, `isLoggedIn`, `userInfo`
   - 如果 `options.redirectOnUnauthorized !== false`，跳转登录页：`wx.reLaunch({ url: '/pages/login/login' })`
5. 其他错误不在 request 层 toast，由页面决定。

### 导出

```javascript
module.exports = { callAPI };
```

---

## 2. 创建 `miniprogram/api/stats.api.js`

```javascript
const { callAPI } = require('./request');

const statsAPI = {
  today() {
    return callAPI('stats/today');
  },
  weekly() {
    return callAPI('stats/weekly');
  },
  monthly() {
    return callAPI('stats/monthly');
  },
  heatmap(year, month) {
    return callAPI('stats/heatmap', { year, month });
  },
};

module.exports = statsAPI;
```

---

## 3. 创建 `miniprogram/api/auth.js`

职责：统一本地登录态读写。

### 必须导出

```javascript
function saveLoginState({ openid, user }) {}
function clearLoginState() {}
function getLoginState() {}
function isLoggedIn() {}
```

### 行为

**saveLoginState({ openid, user })**
- `wx.setStorageSync('openid', openid)`
- `wx.setStorageSync('isLoggedIn', true)`
- `wx.setStorageSync('userInfo', JSON.stringify(user || {}))`

**clearLoginState()**
- remove 上述三个 key

**getLoginState()**
- 返回 `{ openid, isLoggedIn, userInfo }`
- `userInfo` 需 JSON.parse，失败返回 `{}`

**isLoggedIn()**
- 返回 `!!wx.getStorageSync('isLoggedIn') && !!wx.getStorageSync('openid')`

---

## 4. 创建 `miniprogram/api/mappers.js`

职责：后端字段 → 页面字段集中转换。

### 必须导出

```javascript
function mapTaskToView(task) {}
function mapDiaryToView(entry) {}
function mapStatsToView(stats) {}
function formatDuration(minutes) {}
```

### mapTaskToView(task)

输入后端 task：
```javascript
{ _id, title, isDone, estimatedPomodoros, completedPomodoros, priority }
```
输出页面 task：
```javascript
{
  id: task._id,
  text: task.title,
  done: !!task.isDone,
  pomodoros: task.estimatedPomodoros || 1,
  completed: task.completedPomodoros || 0,
  priority: task.priority || 'medium'
}
```

### mapDiaryToView(entry)

输出：
```javascript
{
  id: entry._id,
  date: entry.date,
  emotion: entry.mood || 'calm',
  preview: (entry.content || '').slice(0, 50) + ((entry.content || '').length > 50 ? '...' : ''),
  content: entry.content || '',
  title: entry.title || ''
}
```

### formatDuration(minutes)

- `0 → '0m'`
- `< 60 → 'Xm'`
- `>= 60 → 'Xh Ym'`

---

## 验收检查

- [ ] `request.js` 能处理 401 并清理登录态
- [ ] 新增 `stats.api.js`
- [ ] 新增 `auth.js`
- [ ] 新增 `mappers.js`
- [ ] 未修改任何页面文件
