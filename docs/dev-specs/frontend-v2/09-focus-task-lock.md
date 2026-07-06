# 09-focus-task-lock — 专注任务锁定机制

> 状态: ✅ 已实现  
> 审计: 待办页可在任务被专注页选中使用时直接删除 → 番茄钟结束时 `session/complete` 携带已失效的 `taskId` → 后端 `_incrementTaskPomodoros()` 查不到任务返回 `null` → 番茄计数丢失  
> 契约来源: 本方案为纯前端跨页面锁定，不涉及 API 契约变更

---

## 1. 问题分析

### 数据破坏链路

```
1. focus 页选中任务 A → selectedTaskId = "task_A_id"
2. 用户切换到 todo 页 → 滑动删除任务 A → taskAPI.delete 成功
3. 用户切回 focus 页 → selectedTaskId 仍指向已删除任务
4. 番茄钟结束时 session/complete(taskId="task_A_id")
5. 后端 _incrementTaskPomodoros() 查不到已删除任务 → 返回 null → 🍅 计数丢失
```

### 根因

- **focus 页**：`start()` 没有验证 `selectedTaskId` 在 `availableTasks` 中仍存在
- **todo 页**：删除前没有检查该任务是否正被专注使用
- **无跨页面通信机制**：两个页面之间没有共享状态来判断任务是否"正在使用中"

---

## 2. 解决方案：`wx.setStorageSync` 轻量锁

### 设计原则

- **同步读写**：`wx.setStorageSync` 不依赖网络、无竞态，适合本场景
- **单写多读**：仅 focus 页写入锁，todo 页只读检查
- **异常安全**：页面卸载/重置/跳过/模式切换均强制解锁，不留死锁
- **无需后端改动**：纯前端拦截，后端 `task/delete` 契约不变

### 锁的键名

```
focus_active_task
```

值：当前专注任务的 `_id`（字符串），无锁时键不存在。

---

## 3. 状态模型

```
                    ┌──────────────────────────────────┐
                    │         NO LOCK (初始态)          │
                    │   focus_active_task: undefined    │
                    └──────────┬───────────────────────┘
                               │
                    用户点击「开始」+ mode=focus + 有 selectedTaskId
                               │
                               ▼
                    ┌──────────────────────────────────┐
                    │           LOCKED (锁定态)         │
                    │   focus_active_task: "task_xxx"   │
                    └──────────┬───────────────────────┘
                               │
          ┌────────────────────┼────────────────────┬──────────────┐
          │                    │                    │              │
    番茄钟完成           用户点「重置」      用户点「跳过」    页面卸载
  _onTimerComplete       reset()             skip()         onUnload
          │                    │                    │              │
          ▼                    ▼                    ▼              ▼
  wx.removeStorageSync   wx.removeStorageSync  wx.removeStorageSync  wx.removeStorageSync
  ('focus_active_task')  ('focus_active_task') ('focus_active_task') ('focus_active_task')
          │                    │                    │              │
          └────────────────────┴────────────────────┴──────────────┘
                               │
                               ▼
                    ┌──────────────────────────────────┐
                    │         NO LOCK (恢复初始态)      │
                    └──────────────────────────────────┘
```

### 锁的生命周期

| 事件 | 操作 | 说明 |
|------|------|------|
| `start()` — focus 模式 + 有 selectedTaskId | `setStorageSync` 加锁 | 开始专注时锁定任务 |
| `_onTimerComplete()` — finally 块 | `removeStorageSync` 解锁 | 无论 API 成功/失败都解锁 |
| `reset()` | `removeStorageSync` 解锁 | 用户手动重置 |
| `skip()` | `removeStorageSync` 解锁 | 用户跳过当前时段 |
| `onModeSwitch()` | `removeStorageSync` 解锁 | 切换模式（如 focus→break） |
| `onUnload()` | `removeStorageSync` 解锁 | 页面卸载（防止死锁） |
| `start()` — 任务已失效 | `removeStorageSync` 解锁 | 验证失败时清理锁 |

---

## 4. 实现细节

### 4.1 `pages/focus/focus.js` — 加锁与解锁

#### `start()` 加锁 & 验证 (新增代码)

```javascript
// focus 模式下验证所选任务仍存在（可能被其他端删除）
if (this.data.mode === 'focus' && this.data.selectedTaskId) {
  const taskExists = this.data.availableTasks.some(t => t.id === this.data.selectedTaskId);
  if (!taskExists) {
    this.setData({ selectedTaskId: '', currentTask: '' });
    wx.removeStorageSync('focus_active_task');
    this.onTaskPickerOpen();
    wx.showToast({ title: '任务已失效，请重新选择', icon: 'none' });
    return;
  }
  // 加锁：标记当前正在专注的任务，阻止待办页误删
  wx.setStorageSync('focus_active_task', this.data.selectedTaskId);
}
```

#### `_onTimerComplete()` finally 块解锁

```javascript
finally {
  this.setData({ timeLeft: DURATIONS[mode], progress: 0 });
  wx.removeStorageSync('focus_active_task');
}
```

#### `reset()` / `skip()` / `onModeSwitch()` / `onUnload()` 解锁

每个方法开头（清除定时器后）添加：
```javascript
wx.removeStorageSync('focus_active_task');
```

### 4.2 `pages/todo/todo.js` — 删除前检查

```javascript
async _doDelete(id) {
  // 检查该任务是否正在被专注页使用中
  const activeFocusTaskId = wx.getStorageSync('focus_active_task');
  if (activeFocusTaskId && activeFocusTaskId === id) {
    wx.showToast({ title: '该任务正在进行专注，无法删除', icon: 'none' });
    return;
  }
  // ... 原有删除逻辑
}
```

---

## 5. 被影响文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `pages/focus/focus.js` | 修改 | 加锁/验证/多路径解锁（5 处 +lock，5 处 -lock） |
| `pages/todo/todo.js` | 修改 | `_doDelete()` 删除前检查锁 |

**不修改**：后端 API、API wrapper、其他页面。

---

## 6. 边界情况

| 场景 | 行为 |
|------|------|
| 专注中 → 切到 todo 页 → 尝试删除 | toast "该任务正在进行专注，无法删除" |
| 专注中 → 切到 todo 页 → 尝试滑动删除 | toast 同上，task 弹回 |
| 专注中 → 切到 todo 页 → 菜单"清空已完成"包含该任务 | 已完成任务不会是当前专注任务（isDone=false），天然隔离 |
| 专注完成 → API 调用中 → 用户切到 todo 页 | 锁已解除（finally 块先于 await 后的逻辑执行），可删除 |
| 用户强制杀进程 | 锁随小程序进程销毁，不残留（Storage 在下次冷启动时被清除或过期） |
| 多个番茄钟连续专注同一任务 | 每轮完成时解锁，新一轮开始时重新加锁 |
| selectedTaskId 指向已删除任务 + 点开始 | 验证失败，强制弹出任务选择器 |

---

## 7. 验收检查

- [ ] focus 页选中任务 → 开始专注 → 切到 todo 页 → 滑动删除该任务 → toast 拦截，任务不删除
- [ ] focus 页选中任务 → 开始专注 → 切到 todo 页 → 点删除按钮 → toast 拦截
- [ ] focus 页番茄钟正常完成 → 切到 todo 页 → 该任务可正常删除（锁已释放）
- [ ] focus 页点击重置 → 切到 todo 页 → 该任务可正常删除
- [ ] focus 页点击跳过 → 切到 todo 页 → 该任务可正常删除
- [ ] focus 页切换模式（focus→break）→ 锁释放
- [ ] focus 页选中已删除任务 → 点开始 → 弹出任务选择器 + toast "任务已失效"
- [ ] 未专注中的任务 → 删除流程不受影响
- [ ] 未修改后端 API
