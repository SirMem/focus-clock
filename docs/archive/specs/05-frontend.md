# Dev Spec: 前端页面对接真实 API

## 概览

将现有页面的 mock 数据替换为真实 API 调用。6 个页面，每个页面改动量不大。

| 页面 | 需要引入的 API | 改动位置 |
|------|---------------|---------|
| `pages/todo/todo.js` | `task.api.js` | onLoad → 读取真实数据；增删改 → 调 API |
| `pages/focus/focus.js` | `session.api.js` | 完成番茄 → 调 session/complete；onLoad → 调 stats/today |
| `pages/stats/stats.js` | 暂无（后端未对接） | 将 mock echarts 数据改为调用 stats 接口 |
| `pages/diary/diary.js` | `diary.api.js` | onLoad → 读真实日记列表；保存 → 调 diary/create |
| `pages/login/login.js` | `user.api.js` | 登录成功 → 调 user/login |
| `pages/profile/profile.js` | `user.api.js` | onLoad → 读用户信息 |

## 通用规则

- 每个页面在文件顶部 `require` 对应的 api 模块
- 数据加载时显示 `wx.showLoading`，完成后 `wx.hideLoading`
- 错误时 `wx.showToast({ title: '加载失败', icon: 'none' })`
- 不改变页面的 WXML/WXSS 结构
- 不改变页面 UI 布局

## 1. `pages/login/login.js` — 登录页

### 改动

在 `_doCloudLogin()` 方法中，将 `wx.cloud.callFunction({ name: 'login' })` 替换为：
```javascript
const userAPI = require('../../api/user.api');

// 在 _doCloudLogin 中:
const res = await userAPI.login(nickName, avatarUrl);
```
后续流程不变（存储 openid、跳转 focus 页）。

注意：`nickName` 和 `avatarUrl` 现在需要从 `wx.getUserProfile` 获取。
如果不想获取用户信息，可以传空字符串：
```javascript
const res = await userAPI.login('微信用户', '');
```

## 2. `pages/todo/todo.js` — 待办页

### 改动

**顶部追加:**
```javascript
const taskAPI = require('../../api/task.api');
```

**替换 `INITIAL_TASKS`:** 删除整个 `INITIAL_TASKS` 数组常量。

**修改 `onLoad()`:**
```javascript
onLoad() {
  const sys = wx.getSystemInfoSync();
  this.setData({
    statusBarHeight: sys.statusBarHeight || 44,
    capsuleHeight: 44,
    tasks: [],    // 不再用 INITIAL_TASKS
  }, () => {
    this._loadTasks();
    this._updateComputed();
  });
},
```
新增 `_loadTasks()` 方法:
```javascript
async _loadTasks() {
  wx.showLoading({ title: '加载中...' });
  try {
    const res = await taskAPI.list({ isDone: this.data.filter === 'done' ? true : this.data.filter === 'active' ? false : undefined });
    wx.hideLoading();
    if (res.code === 0) {
      // 映射 API 格式到页面格式
      const tasks = res.data.tasks.map(t => ({
        id: t._id,
        text: t.title,
        done: t.isDone,
        pomodoros: t.estimatedPomodoros || 1,
        completed: t.completedPomodoros || 0,
        priority: t.priority,
      }));
      this.setData({ tasks }, () => this._updateComputed());
    }
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: '加载失败', icon: 'none' });
  }
}
```

**修改 `onInputSend()`（创建任务）:**
```javascript
async onInputSend() {
  const text = this.data.input.trim();
  if (!text) return;

  // 调 API
  wx.showLoading({ title: '创建中...' });
  try {
    const res = await taskAPI.create(text, 'medium', 1);
    wx.hideLoading();
    if (res.code === 0) {
      this.setData({ input: '', hasInput: false });
      this._loadTasks(); // 重新加载列表
    }
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: '创建失败', icon: 'none' });
  }
}
```

**修改 `onToggleDone()`（切换完成状态）:**
```javascript
async onToggleDone(e) {
  const id = e.currentTarget.dataset.id;
  const task = this.data.tasks.find(t => t.id === id);
  if (!task) return;

  wx.showLoading({ title: '更新中...' });
  try {
    await taskAPI.update(id, { isDone: !task.done });
    wx.hideLoading();
    await this._loadTasks();
  } catch (err) {
    wx.hideLoading();
  }
}
```

**修改 `onDeleteTask()`（删除任务）:**
```javascript
async onDeleteTask(e) {
  const id = e.currentTarget.dataset.id;
  wx.showLoading({ title: '删除中...' });
  try {
    await taskAPI.delete(id);
    wx.hideLoading();
    await this._loadTasks();
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: '删除失败', icon: 'none' });
  }
}
```

**修改 `onFilterChange()`（切换筛选）:**
切换后调用 `_loadTasks()` 而非本地过滤。

## 3. `pages/focus/focus.js` — 专注页

### 改动

**顶部追加:**
```javascript
const sessionAPI = require('../../api/session.api');
```

**修改 `onLoad()`:** 加载今日统计
```javascript
async onLoad() {
  const sysInfo = wx.getSystemInfoSync();
  const menuInfo = wx.getMenuButtonBoundingClientRect();
  const capsuleHeight = menuInfo.height + (menuInfo.top - sysInfo.statusBarHeight) * 2;

  this.setData({
    statusBarHeight: sysInfo.statusBarHeight,
    capsuleHeight,
  });

  // 加载今日统计
  await this._loadTodayStats();
},
```
新增 `_loadTodayStats()`:
```javascript
async _loadTodayStats() {
  try {
    const res = await sessionAPI.list({ page: 1, pageSize: 1 });
    if (res.code === 0) {
      // 这里简化处理，统计页有完整数据
      // 专注页只显示今日专注时长和番茄数
    }
  } catch (err) {
    // 静默失败，不影响计时器使用
  }
}
```

**修改 `onComplete()` 方法**（番茄完成后），追加调用：
```javascript
// 在现有 onComplete 逻辑末尾追加:
async onComplete() {
  // ... 现有计时器重置逻辑 ...

  // 记录完成会话
  try {
    await sessionAPI.complete(this.data.mode, this.data.timeLeft, {
      taskId: null,
      completedPomodoro: this.data.mode === 'focus',
    });
    // 更新显示
    const newSessions = this.data.sessions + 1;
    this.setData({
      sessions: newSessions,
      statItems: this._buildStatItems(newSessions),
    });
  } catch (err) {
    console.error('Failed to record session', err);
  }
}
```

**修改 `_buildStatItems(sessions)` 方法**，动态计算时间：
```javascript
_buildStatItems(sessions) {
  const focusMinutes = sessions * 25;
  const hours = Math.floor(focusMinutes / 60);
  const mins = focusMinutes % 60;
  return [
    { label: '今日专注', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`, icon: '⏱️' },
    { label: '今日番茄', value: `${sessions} 个`, icon: '🍅' },
  ];
}
```

## 4. `pages/diary/diary.js` — 日记页

### 改动

**顶部追加:**
```javascript
const diaryAPI = require('../../api/diary.api');
```

**删除 `HISTORY_ENTRIES` 常量。**

**修改 `onLoad()`:**
```javascript
async onLoad() {
  const sys = wx.getSystemInfoSync();
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${days[now.getDay()]}`;
  const promptIdx = Math.floor(Math.random() * AI_PROMPTS.length);
  this.setData({
    statusBarHeight: sys.statusBarHeight || 44,
    capsuleHeight: 44,
    todayDate: dateStr,
    currentPrompt: AI_PROMPTS[promptIdx],
  });

  await this._loadEntries();
}
```

新增 `_loadEntries()`:
```javascript
async _loadEntries() {
  wx.showLoading({ title: '加载中...' });
  try {
    const res = await diaryAPI.list({ pageSize: 50 });
    wx.hideLoading();
    if (res.code === 0) {
      const historyEntries = res.data.entries.map(e => ({
        id: e._id,
        date: e.date,
        emotion: e.mood || 'calm',
        preview: e.content.slice(0, 50) + (e.content.length > 50 ? '...' : ''),
      }));
      this.setData({ historyEntries });
    }
  } catch (err) {
    wx.hideLoading();
  }
}
```

**修改 `onSave()`:**
```javascript
async onSave() {
  if (!this.data.content.trim()) {
    wx.showToast({ title: '请先写点内容', icon: 'none' });
    return;
  }

  wx.showLoading({ title: '保存中...' });
  try {
    const res = await diaryAPI.create(
      this.data.currentPrompt,
      this.data.content,
      this.data.selectedEmotion,
      []
    );
    wx.hideLoading();
    if (res.code === 0) {
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ content: '', charCount: 0 });
      await this._loadEntries();
    }
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: '保存失败', icon: 'none' });
  }
}
```

## 5. `pages/stats/stats.js` — 统计页

### 改动

目前统计页使用 ECharts 展示硬编码 mock 数据。
这次改动将 **mock 数据保持不变**，但添加 `_loadStats()` 方法作为准备。

**顶部追加:**
```javascript
// 暂不引入 stats.api.js，先用 mock 数据
// 后续第 2 轮集成
```

**本次不做实际对接**，仅添加注释标记。Stats 页的实际对接在 Stats 后端全部就位后单独处理。

## 6. `pages/profile/profile.js` — 个人页

### 改动

**顶部追加:**
```javascript
const userAPI = require('../../api/user.api');
```

**修改 `onLoad()`，加载用户信息:**
```javascript
async onLoad() {
  const sys = wx.getSystemInfoSync();
  this.setData({ statusBarHeight: sys.statusBarHeight || 44, capsuleHeight: 44 });

  try {
    const res = await userAPI.getInfo();
    if (res.code === 0) {
      this.setData({
        isLoggedIn: true,
        // 假设页面有 nickName/avatarUrl 字段
      });
    }
  } catch (err) {
    // 用户未登录
  }
}
```

## 7. `pages/coach/coach.js` — 教练页

本次不做改动（MVP 范围不包含 AI 教练）。

## 验收检查表

- [ ] login 页调用 `userAPI.login()` 替代直接调旧 login 云函数
- [ ] todo 页的 onLoad 从 API 拉取真实任务列表
- [ ] todo 页的创建/切换状态/删除操作都调用了 taskAPI
- [ ] todo 页在上屏前做了数据格式映射（API 格式 → 页面格式）
- [ ] focus 页完成番茄后调用了 `sessionAPI.complete()`
- [ ] diary 页的 onLoad 从 API 拉取日记列表
- [ ] diary 页的 onSave 调用 `diaryAPI.create()`
- [ ] profile 页从 API 读取用户信息
- [ ] 所有 API 调用有 loading/error 处理
- [ ] 没有修改 WXML/WXSS 文件
