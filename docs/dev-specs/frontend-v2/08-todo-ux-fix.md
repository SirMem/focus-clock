# 08-todo-ux-fix — Todo 页 FAB 按钮功能修复

> 状态: 🚧 需实现  
> 审计: FAB（右下角蓝色加号）点击后无任何有效操作，用户感受为"按钮没作用"
> 契约来源: 本页面已有 `taskAPI.create` 和 `onAddTask`，修复仅在于让 FAB 正确串联到输入流程

---

## 1. 审计发现

| # | 问题 | 严重度 |
|---|---|---|
| 1 | `onFabTap` 只清空 input + 调用 `wx.pageScrollTo`（no-op，因为页面 `overflow:hidden` 无页面级滚动） | **高** |
| 2 | FAB 不聚焦输入框、不弹出键盘、不创建任务 | — |
| 3 | 快速添加输入框本身功能完整：`onInputChange` → `hasInput` → `onAddTask` → `taskAPI.create` | ✅ |

根因：FAB 被设计为一个"滚动到输入框位置"的辅助方法，但页面布局不支持页面滚动，聚焦逻辑也未实现。用户点击醒目蓝色加号，期望的是"开始创建任务"，但什么都没发生。

---

## 2. P0 修复方案（推荐方案一：聚焦输入框）

### 目标

FAB 点击后：
1. 聚焦输入框 + 弹出键盘
2. 滚动到列表顶部（通过 scroll-view 的 scroll-top 属性）
3. 用户直接在输入框中输入 → 点击发送按钮或键盘确认 → 创建任务

### 2.1 `pages/todo/todo.wxml` 改动

input 增加 `focus` 属性和 `bindblur`：

```html
<input
  class="add-input"
  placeholder="添加新任务..."
  placeholder-style="color:#C0C4CC;font-size:14px"
  value="{{input}}"
  focus="{{inputFocus}}"
  bindinput="onInputChange"
  bindconfirm="onAddTask"
  bindblur="onInputBlur"
  confirm-type="done"
/>
```

### 2.2 `pages/todo/todo.js` 改动

data 新增：

```javascript
inputFocus: false,
scrollTop: 0,
```

`onFabTap` 改为：

```javascript
onFabTap() {
  this.setData({
    inputFocus: true,
    scrollTop: 0,
  });
},
```

`onInputBlur` 新增：

```javascript
onInputBlur() {
  this.setData({ inputFocus: false });
},
```

`onAddTask` 完成后自动聚焦（方便连续添加）：

```javascript
async onAddTask() {
  const text = this.data.input.trim();
  if (!text) return;

  try {
    await taskAPI.create(text, 'medium', 1);
    this.setData({ input: '', hasInput: false, inputFocus: true });
    await this._loadTasks({ silent: true });
  } catch (err) {
    wx.showToast({ title: '创建失败', icon: 'none' });
  }
},
```

### 2.3 `pages/todo/todo.wxss` 改动（可选）

输入框聚焦时加一个高亮边框动画，让用户清楚看到焦点转移：

```css
.add-input:focus {
  border-color: #4A90D9;
}
```

---

## 3. 允许修改文件

| 文件 | 内容 |
|---|---|
| `pages/todo/todo.js` | data 增加 `inputFocus`/`scrollTop`；修改 `onFabTap`、`onInputBlur`、`onAddTask` |
| `pages/todo/todo.wxml` | input 增加 `focus` 和 `bindblur` |
| `pages/todo/todo.wxss` | 可选：聚焦样式 |

不要修改后端、API wrapper、其他页面。

---

## 4. 禁止

- 禁止打开 `wx.showModal` 或弹窗作为替代（体验打折，不是产品预期）。
- 禁止直接把 FAB 绑定到 `onAddTask`（空输入时 `onAddTask` 会 `if (!text) return`，FAB 同样无反应）。

---

## 5. 验收检查

- [ ] 点击 FAB 后，输入框立即获得焦点并弹出键盘。
- [ ] 输入文字后点击发送按钮（或键盘确认），任务创建成功。
- [ ] 创建成功后，输入框保持聚焦状态（连续添加体验）。
- [ ] 点击页面其他区域后，输入框失焦（`onInputBlur` 正常）。
- [ ] 空态/有任务时 FAB 行为一致。
- [ ] 未修改后端、未修改其他页面。
