好问题！这正是番茄钟和待办**关联**的关键设计点。我来解释完整的交互流程，以及如何在 Figma 原型中体现：

---

## 🔗 完整流程：待办 → 专注 → 反馈

### Step 1: 开始专注前 — 选择当前任务

你**不是在待办列表里看正在做什么**，而是在**开始番茄钟时选择要做哪个任务**。

> **专注页的操作流程：**
> 1. 进入「专注」页面 → 点击 **"开始"** 按钮
> 2. → 底部弹出一个 **任务选择面板（Task Picker）**，列出你的待办列表
> 3. → 你从中**点击选择** "📖 复习高数第三章"
> 4. → 面板关闭，番茄钟开始计时，同时页面显示👇

```
 ┌─────────────────────────┐
 │        25:00            │  ← 大号倒计时
 │     专注中 · 番茄 2/4    │
 │                         │
 │  📖 复习高数第三章       │  ← 🔥 当前正在做的任务名，突出显示
 │                         │
 │  [⏸️]  [⏹️]  [⏭️]       │
 └─────────────────────────┘
```

> **关键**：番茄钟页面上**直接显示当前任务名**，让你一目了然知道此刻在做什么。

---

### Step 2: 番茄钟结束后 — 自动统计

25 分钟到 ⏰ → 任务自动关联完成：

```
复习高数第三章 → 🍅 +1（之前 2 个 → 变成 🍅 ×3）
```

你回到待办列表就看到更新：

```
□ 📖 复习高数第三章    🍅 ×3    🔴
□ 💻 写项目报告         🍅 ×1    🟡
□ 📧 回复导师邮件       🍅 ×0    ⚪
```

---

### Step 3: 多任务切换场景

如果你今天想交替做不同的事：

```
 时间      操作                   当前任务
──────────────────────────────────────────
 09:00  选"复习高数"开始番茄     📖 复习高数第三章
 09:25  番茄完成 → 🍅 +1
 09:30  休息5分钟
 09:35  选"写报告"开始番茄       💻 写项目报告
 10:00  番茄完成 → 🍅 +1
```

**每次开始新的番茄钟，都可以重新选任务**，自由度很高。

---

## 🎨 对应 Figma 原型设计：任务选择面板（Task Picker）

如果你想在 Figma Make 中把这个交互设计出来，可以用这个 **补充 Prompt**：

```
Design a task selection bottom sheet modal for a Pomodoro timer app.

Layout:
- Trigger: User taps "开始专注" button on the timer page
- Bottom sheet slides up from bottom (rounded 24px top corners, white background)
- Title: "选择要专注的任务" with a close "✕" button on top-right
- Search bar: "搜索任务..." with a search icon
- Task list (each item 60px height):
  Each item has:
  - Left: Radio button circle (blue empty, or blue filled with white dot for selected)
  - Middle: Task name text (16px, black) + 🍅 count label in gray
  - Right: Priority dot (red/yellow/gray)
- Selected state: One item has blue radio button filled, with a subtle blue background highlight
- Bottom: "开始专注 25分钟" full-width blue button (disabled if no task selected, enabled when one is selected)
- Below button: "跳过，无关联任务" (small gray text link)

The list should scroll if there are many tasks. The selected task is clearly highlighted.
```

> 这个面板可以加到「专注页」Prompt 中，放在点击"开始"按钮之后的流程里。

---

## 📋 在待办列表中的视觉反馈

回到你的待办列表设计，为了让用户**一眼看出哪些任务做过、做得多**，可以这样优化：

```
┌─────────────────────────────────┐
│  □ 📖 复习高数第三章  🍅×3  🔴  │  ← 番茄数标签
│  ☑️ 💻 写项目报告       🍅×1  🟡  │  ← 已完成也显示
│  □ 📧 回复导师邮件             ⚪  │  ← 没做过的不显示🍅
│  □ 🏋️ 去健身房                ⚪  │
└─────────────────────────────────┘
```

**视觉规则：**
- `🍅 ×0` → **不显示**（没做过，保持干净）
- `🍅 ×1~2` → **显示标签**（做过一点）
- `🍅 ×3+` → **标签突出**（投入多，有成就感）

---

### 一句话总结

> **不是"从待办列表看正在做什么"，而是"开始番茄钟时选任务，计时页面上一直显示它"。** 待办列表的 `🍅 ×3` 是**历史统计**，告诉你"这个任务已经投入了多少番茄"，而不是"当前在做哪个"。