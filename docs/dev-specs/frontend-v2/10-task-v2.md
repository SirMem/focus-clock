# Task v2 轻量任务规划器开发规格

> 状态: ✅ 本轮开发标准  
> 日期: 2026-07-06  
> 范围: 微信小程序 `pages/todo/*`、任务 API、`focus-api` Task 模块  
> 上游契约: `docs/api-contracts.md` §2

---

## 1. 背景

当前 Task 页面主要支持「输入标题 → 创建任务 → 完成/删除」，只能表达“我要做什么”。对于产品主循环「计划 → 执行 → 反思 → 优化」来说，Task 页面需要承担更完整的“计划”职责：

- 任务是否有截止时间；
- 是否需要每天/每周重复；
- 是否可以拆成可执行子步骤；
- 预计需要几个番茄钟；
- 哪些任务优先级更高；
- 任务卡片能否在列表里直接展示这些规划信息。

---

## 2. 目标

将 Task 页面升级为「轻量任务规划器」：

1. 保留顶部 Quick Add，用于快速创建只有标题的任务。
2. 点击悬浮按钮 FAB 打开任务弹窗，用于完整创建任务。
3. 支持任务说明、优先级、预计番茄、子任务、截止时间、重复规则。
4. 任务卡片展示任务规划摘要，包括截止时间、重复、子任务进度、番茄进度、优先级。
5. 后端 Task API 按 Task v2 契约保存、更新、返回新字段。
6. 兼容旧任务数据，旧记录缺字段时前后端都要提供默认值。

---

## 3. 非目标

本阶段不做：

- 多人协作、项目空间、清单分组；
- 日历视图、拖拽排序；
- 系统提醒/订阅消息通知；
- 复杂自定义重复规则（如每月第 2 个周一）；
- 子任务单独增删改 API，第一版使用整体替换；
- 离线冲突合并。

---

## 4. 用户故事

- 作为学生，我希望给任务设置截止时间，这样能知道今天必须完成什么。
- 作为备考用户，我希望把大任务拆成几个步骤，这样不会被大任务压垮。
- 作为习惯养成用户，我希望设置每日/每周重复任务，这样不用每天重复创建。
- 作为专注 app 用户，我希望设置预计番茄数，这样能把计划和番茄执行关联起来。

---

## 5. 交互标准

### 5.1 Quick Add

顶部输入框保留，行为如下：

- 输入标题后点击加号或键盘确认创建任务；
- 只传 `title`，其他字段由前端/后端默认值补齐；
- 默认优先级 `medium`，预计番茄 `1`，无子任务、无截止时间、不重复。

### 5.2 FAB 完整创建

点击悬浮按钮打开底部半屏弹窗：

- 弹窗标题：`新建任务`；
- 背景遮罩可点击关闭；
- 表单内容可在小屏滚动；
- `保存任务` 仅在标题非空时有效；
- 保存成功后关闭弹窗并刷新任务列表。

### 5.3 弹窗字段

| 字段 | 类型 | 默认 | 规则 |
|------|------|------|------|
| 标题 | input | 空 | 必填，1-100 字 |
| 说明 | textarea | 空 | 可选，最多 500 字 |
| 优先级 | segmented | medium | low / medium / high |
| 预计番茄 | chips | 1 | 1 / 2 / 3 / 4 |
| 子任务 | 开关 + 列表 | 关闭 | 开启后可添加/删除步骤，最多 20 个 |
| 截止时间 | 开关 + date/time picker | 关闭 | 开启后写入 `dueAt` |
| 重复 | 开关 + chips | 关闭 | none / daily / weekly / weekdays |

### 5.4 任务卡片展示

任务卡片主信息：

- 复选圆点；
- 任务标题；
- 优先级 badge；
- 元信息行。

元信息行按存在才展示：

```text
截止：今天 18:00 · 每天重复 · 子任务 1/3 · 🍅 0/2
```

旧任务缺少字段时不得渲染异常。

---

## 6. Task v2 数据模型

```typescript
type TaskRepeatType = 'none' | 'daily' | 'weekly' | 'weekdays';
type TaskPriority = 'low' | 'medium' | 'high';

type TaskV2 = {
  _id: string;
  _openid: string;
  title: string;
  description: string;
  isDone: boolean;
  priority: TaskPriority;
  estimatedPomodoros: number;
  completedPomodoros: number;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
  dueAt: number | null;
  repeat: {
    enabled: boolean;
    type: TaskRepeatType;
    interval: number;
  };
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};
```

### 默认值

```typescript
{
  description: '',
  isDone: false,
  priority: 'medium',
  estimatedPomodoros: 1,
  completedPomodoros: 0,
  subtasks: [],
  dueAt: null,
  repeat: { enabled: false, type: 'none', interval: 1 },
  completedAt: null
}
```

---

## 7. API 契约摘要

详见 `docs/api-contracts.md` §2。

本 spec 要求：

- `task/create` 接收 Task v2 字段并补齐默认值；
- `task/list` 返回 normalized Task v2；
- `task/update` 只允许更新白名单字段；
- `subtasks` 第一版整体替换；
- `completedAt` 随 `isDone` 自动维护；
- 旧数据通过 service normalize，前端 mapper 再做一层兜底。

---

## 8. 验收标准

### 文档

- 本 spec 存在并定义目标、非目标、模型、交互、验收；
- `docs/api-contracts.md` §2 与实现字段一致。

### 前端

- FAB 打开完整任务弹窗；
- 可创建只有标题的任务；
- 可创建带说明、子任务、截止时间、重复规则、优先级、预计番茄的任务；
- 任务列表能展示新字段摘要；
- Quick Add 保持可用；
- 旧任务缺少新字段时页面不报错。

### 后端

- `task/create` 保存 Task v2 字段；
- `task/list` 返回 Task v2 字段；
- `task/update` 更新 Task v2 白名单字段；
- 非法 priority、estimatedPomodoros、repeat.type、subtasks 返回 400；
- 旧数据经 normalize 后返回默认字段。
