# 11-completed-task-fix — 修复 daily_summaries.completedTasks 缺失写入 & todo 页"今日专注"标签

> 状态: 🚧 需实现
> 关联契约: [`../../api-contracts.md`](../../api-contracts.md) §5 (Stats)
> 相关设计: [`../../archive/issues/03-stats-module.md`](../../archive/issues/03-stats-module.md)
> 目标: 补全 `daily_summaries.completedTasks` 的写入链路，修复 todo 页底部栏"今日专注"显示的虚假数据

---

## 1. 依赖

- Stats 模块后端正运行（`daily_summaries` 集合存在）
- Task 模块后端运行（`task/update` 路由正常工作）
- `focus-api` 云函数可正常部署

---

## 2. 允许修改文件

| 层 | 文件 | 操作 |
|---|---|---|
| 后端 | `cloudfunctions/focus-api/services/task.service.js` | **改造**：注入 `dailySummaryRepo`，`updateTask()` 中在 `isDone: true` 时 upsert |
| 后端 | `cloudfunctions/focus-api/services/task.service.js` | **改造**：`create()` 工厂方法同时初始化 `DailySummaryRepo` |
| 前端 | `pages/todo/todo.js` | **改造**：底部栏"今日专注"改为从 `statsAPI.today()` 获取真实数据 |
| 前端 | `pages/todo/todo.wxml` | **少量修改**：底部栏绑定 `realTotalHours` / `realTotalMins` / `realPomodoroCount` |

不要修改：
- `task.routes.js`（无需改动路由层）
- `daily-summary.repo.js`（upsert 已用 `_.inc()` 原子递增，无需改动）
- `session.service.js`（已完成番茄钟时长由 session complete 写入，tasks 完成计数由 task update 写入——两个独立写入时机，详见 §3）
- `stats.api.js`（已有 `today()` 方法，返回 `{ focusMinutes, pomodoroCount, completedTasks }`）
- `stats.service.js`（`getTodayStats()` 已返回 `completedTasks` 字段）

---

## 3. 当前问题

### 3.1 两个独立的写入时机（架构说明）

`daily_summaries` 的字段有两个独立的写入来源，各自由不同的用户行为触发：

| 字段 | 触发行为 | 写入位置 |
|------|---------|---------|
| `focusMinutes` / `pomodoroCount` | 番茄钟结束 | `session.service.js` → `completeSession()` |
| `completedTasks` | **任务被勾选完成** | ❌ 当前缺失 |

`session.service.js` 的 `completeSession()` 负责番茄钟结束后的聚合——它写入 `focusMinutes` 和 `pomodoroCount`。但 `completedTasks` 的正确触发时机是**用户在 todo 页勾选任务为"已完成"**，这与番茄钟结束是两个独立事件。因此本修复在 `task.service.js` 的 `updateTask()` 中触发 `completedTasks` 的写入，而非在 `session.service.js` 中补字段。

### 3.2 问题 A：`daily_summaries.completedTasks` 永远为 0

**根源**：没有任何代码在任务完成时向 `daily_summaries` 写入 `completedTasks`。

当前唯一写入 `daily_summaries` 的地方是 `session.service.js` 第 99-103 行：

```js
// session.service.js 当前代码
await this.dailySummaryRepo.upsert(openId, dateStr, {
  focusMinutes: Math.round(duration / 60),
  pomodoroCount: 1,
  // completedTasks 从未传入 —— 但这不属于 session.service 的职责
});
```

`task.service.js` 当前完全没有注入 `DailySummaryRepo`，`updateTask()` 只更新 task 自身，不联动日汇总。

而 `stats/today` 接口会返回 `completedTasks` 字段（`stats.service.js` 第 50 行）：

```js
// stats.service.js getTodayStats()
completedTasks: record.completedTasks || 0,  // 永远是 0
```

**影响**：
- Stats 页"完成任务数"永远显示 0
- Stats 页"完成率"不准确（分母为活跃天数但分子为 0）

### 3.3 问题 B：todo 页底部栏"今日专注"显示的是历史累计时长

```js
// todo.js _updateComputed() 第 136 行
const totalFocusMins = tasks.reduce((sum, t) => sum + t.completed * 25, 0);
```

这段代码计算的是 **所有任务累计的 completedPomodoros × 25 分钟**，不是今日真实的专注时长。但 WXML 标签写的是"今日专注"：

```html
<!-- todo.wxml 第 131 行 -->
今日专注 <text class="summary-num-blue">{{totalHours}}h{{totalMins}}m</text>
```

**影响**：用户看到的是"历史总时长"，不是"今日数据"，标签名不副实。

---

## 4. 后端修复

### 4.1 `task.service.js` — 注入 DailySummaryRepo + 同步 completedTasks

#### 4.1.1 修改构造函数和工厂方法

当前构造函数只接受 `taskRepo`：

```js
// task.service.js 当前
class TaskService {
  constructor(taskRepo) {
    this.taskRepo = taskRepo;
  }

  static create() {
    const TaskRepo = require('../repositories/task.repo');
    return new TaskService(TaskRepo.create());
  }
```

改造为同时注入 `DailySummaryRepo`：

```js
// task.service.js 改造后
class TaskService {
  constructor(taskRepo, dailySummaryRepo) {
    this.taskRepo = taskRepo;
    this.dailySummaryRepo = dailySummaryRepo;  // 🆕
  }

  static create() {
    const TaskRepo = require('../repositories/task.repo');
    const DailySummaryRepo = require('../repositories/daily-summary.repo');  // 🆕
    return new TaskService(
      TaskRepo.create(),
      DailySummaryRepo.create(),  // 🆕
    );
  }
```

#### 4.1.2 文件顶部导入

在文件顶部补充 `getDateStr` 导入（使用已有工具函数，与 `session.service.js`、`stats.service.js` 保持一致）：

```js
// task.service.js 顶部新增
const { getDateStr } = require('../utils/helpers');
```

> **注意**：`getDateStr` 位于 `cloudfunctions/focus-api/utils/helpers.js`，已被 `session.service.js`、`stats.service.js`、`coach.service.js` 等多个模块使用。

#### 4.1.3 在 `updateTask()` 中新增同步逻辑

当前 `updateTask()` 实现：

```js
async updateTask(openId, id, data) {
  const existing = await this.taskRepo.findById(id);
  if (!existing) return null;
  if (existing._openid !== openId) return false;

  const now = Date.now();
  const updateData = this._normalizeUpdateInput(data, existing, now);

  return this.taskRepo.updateById(id, updateData);
}
```

改造后：

```js
async updateTask(openId, id, data) {
  const existing = await this.taskRepo.findById(id);
  if (!existing) return null;
  if (existing._openid !== openId) return false;

  const now = Date.now();
  const updateData = this._normalizeUpdateInput(data, existing, now);

  const result = await this.taskRepo.updateById(id, updateData);

  // 🆕 [PRD] 任务刚被标记完成 → 同步到 daily_summaries
  // 背景：_normalizeUpdateInput 已在 false→true 时设置 completedAt=now
  // 此处复用同一判断条件，确保 completedTasks 与 completedAt 同时触发
  // [BDD 场景2] 只有 isDone 从 false→true 时才触发，防止重复计数
  const becameDone = data.isDone === true && !existing.isDone;
  if (becameDone) {
    try {
      const today = getDateStr();  // "2026-07-09"
      await this.dailySummaryRepo.upsert(openId, today, {
        completedTasks: 1,  // 原子 +1（已有记录走 _.inc()，新记录走初始值）
      });
    } catch (err) {
      // ⚠️ 部分写入容错：task 已更新但 daily_summaries 写入失败
      // 策略：仅记录日志，不 revert task（微信云数据库无事务支持，revert 也可能失败）
      // 影响：completedTasks 少计 1 次，属于可接受的短暂不一致
      // 后续 session complete 或其他操作不会修正此值，需依赖后台修复脚本
      console.error('[TaskService.updateTask] daily_summaries upsert 失败，completedTasks 丢失 +1:', err.message);
    }
  }

  return result;
}
```

> **设计决策**：选择容错日志而非补偿回滚（revert task），原因：
> 1. 微信云数据库不支持事务，revert 也可能失败
> 2. `completedTasks` 非核心计费数据，偶然丢失 +1 的用户影响极小
> 3. 避免因 `daily_summaries` 写入失败导致整个 task update 请求报错

> **已知限制（并发竞态）**：如果两个请求几乎同时标记同一任务完成（都读到 `existing.isDone === false`），`completedTasks` 会 double-count。概率极低（需同一用户同时操作同一任务），当前不处理。如果未来需要严格保证，可改用 MongoDB 的 `findOneAndUpdate` + 乐观锁或引入幂等键。

---

## 5. 前端修复

### 5.1 `pages/todo/todo.js` — 底部栏接入真实数据

#### 5.1.1 新增导入

在文件顶部新增（与已有 `taskAPI` 导入风格一致）：

```js
const statsAPI = require('../../miniprogram/api/stats.api');
```

#### 5.1.2 在 `data` 中新增字段

```js
data: {
  // ... 现有字段
  realTotalHours: 0,     // 🆕 真实今日专注时长（小时部分）
  realTotalMins: 0,      // 🆕 真实今日专注时长（分钟部分）
  realPomodoroCount: 0,  // 🆕 真实今日番茄数
  realStatsLoaded: false, // 🆕 stats 数据是否已成功加载（区分"加载中"和"真的为 0"）
}
```

#### 5.1.3 新增 `_loadDailyStats()` 方法

```js
// 🆕 新增方法：从 stats/today 获取真实今日数据
async _loadDailyStats() {
  try {
    const res = await statsAPI.today();
    if (res.code === 0 && res.data) {
      const data = res.data;
      const focusMinutes = data.focusMinutes || 0;
      const pomodoroCount = data.pomodoroCount || 0;

      this.setData({
        realTotalHours: Math.floor(focusMinutes / 60),
        realTotalMins: focusMinutes % 60,
        realPomodoroCount: pomodoroCount,
        realStatsLoaded: true,
      });
    } else {
      // API 返回异常 code，保留已有值
      console.warn('stats/today 返回异常:', res);
    }
  } catch (err) {
    console.error('加载今日统计数据失败', err);
    // 静默失败，保留已有值（首次加载失败时显示 "--" 而非 "0h0m"）
  }
}
```

#### 5.1.4 在 `onLoad()` 和 `onShow()` 中调用

修改现有 `onLoad()`，新增 `onShow()`：

```js
// pages/todo/todo.js

async onLoad() {
  const sys = wx.getWindowInfo();
  const statusBarHeight = sys.statusBarHeight || 44;
  const capsuleHeight = 44;
  this.setData({
    statusBarHeight,
    capsuleHeight,
    tasks: [],
  }, async () => {
    await Promise.all([
      this._loadTasks(),
      this._loadDailyStats(),  // 🆕
    ]);
    this._updateComputed();
  });
},

// 🆕 每次回到 todo 页时刷新真实统计数据
async onShow() {
  await this._loadDailyStats();
},
```

> **注意**：`onLoad` 中用 `Promise.all` 并行加载 tasks 和 stats，减少首屏等待时间。`onShow` 只刷新 stats（tasks 通过切换完成状态时的 silent reload 已更新）。

#### 5.1.5 `_updateComputed()` 保持不变

`_updateComputed()` 中计算的 `totalHours` / `totalMins`（历史累计）保留不动——它们不再被 WXML 使用，但保留在 data 中不破坏现有数据流，未来如需切换回历史数据展示可快速恢复。

### 5.2 `pages/todo/todo.wxml` — 底部栏展示真实数据

```html
<!-- todo.wxml 底部栏，改造后 -->
<view class="summary-bar">
  <text class="summary-left">
    已完成 <text class="summary-num-green">{{doneCount}}</text>/{{tasks.length}}
  </text>
  <text class="summary-right" wx:if="{{realStatsLoaded}}">
    今日专注 <text class="summary-num-blue">{{realTotalHours}}h{{realTotalMins}}m</text>
    · 🍅 {{realPomodoroCount}}
  </text>
  <text class="summary-right summary-right--muted" wx:else>
    今日专注 <text class="summary-num-blue">--</text>
  </text>
</view>
```

> **降级策略**：`realStatsLoaded` 为 false 时显示 `--`，避免谎报 `0h0m`。首次加载失败或 API 异常时用户看到的是占位符而非虚假数据。

---

## 6. BDD 场景

### 场景 1：完成一个任务后 stats 页能看到计数

```
Given 用户有 1 个未完成任务（isDone: false）
When 用户通过 task/update 将 isDone 设为 true
Then daily_summaries 中当天的 completedTasks 原子 +1
  And stats/today 返回的 completedTasks 为 1
```

### 场景 2：多次勾选同一任务不会重复计数

```
Given 用户有一个已完成任务（isDone: true）
When 用户再次调用 task/update 将 isDone 设为 true（重复操作）
Then daily_summaries 的 completedTasks 不会再次递增
  （因为 existing.isDone === true，不满足 becameDone 条件）
```

### 场景 3：取消完成后再完成，应该计数

```
Given 用户有一个已完成任务（isDone: true）
When 用户将其改为 isDone: false（取消完成）
  _normalizeUpdateInput 将 completedAt 设为 null
  然后再改为 isDone: true（重新完成）
  _normalizeUpdateInput 将 completedAt 设为 now
Then completedTasks 递增 1 次（重新完成时）
  （从 false→true 才触发 becameDone）
```

### 场景 4：todo 页底部栏显示真实今日数据

```
Given 用户今日完成了 3 个番茄，专注 75 分钟
When 用户进入 todo 页
Then 底部栏右侧显示"今日专注 1h15m · 🍅 3"
  （来自 stats/today 的真实数据，而非 tasks 的历史累计）
```

### 场景 5：stats 页完成任务数不再为 0

```
Given 用户今日完成了 2 个任务
When 用户进入 stats 页
Then 摘要卡片中"完成任务"显示 2
  （来自 daily_summaries.completedTasks）
```

### 场景 6：API 失败时静默降级

```
Given 用户进入 todo 页
When stats/today 接口返回异常或网络不可达
Then todo 页底部栏显示"今日专注 --"（占位符）
  And 不弹 toast 打扰用户
  And 不崩溃
```

---

## 7. 验收检查

### 后端

- [ ] `task.service.js` 构造函数成功注入第二个参数 `DailySummaryRepo`
- [ ] `create()` 工厂方法正确初始化 `DailySummaryRepo.create()`
- [ ] 文件顶部正确导入 `{ getDateStr } from '../utils/helpers'`
- [ ] 任务标记完成（`isDone: false→true`）时，`daily_summaries.completedTasks` 递增 1
- [ ] 重复标记同一任务完成不会重复计数（`existing.isDone === true` 时跳过）
- [ ] 取消完成后再完成，只计 1 次（`false→true` 才触发）
- [ ] `daily_summaries` upsert 失败时**不抛异常**，仅 `console.error` 日志

### 前端

- [ ] todo 页底部栏右侧显示真实今日专注时长（来自 `statsAPI.today()`，与 focus 页一致）
- [ ] todo 页底部栏同时显示真实今日番茄数（`🍅 N`）
- [ ] todo 页 `onLoad` 时并行加载 tasks + stats
- [ ] todo 页 `onShow` 时刷新 stats（从其他页面回来时数据最新）
- [ ] API 失败时底部栏显示 `--`，不弹 toast，不崩溃
- [ ] stats 页 `completedTasks` 不再为 0（**前提**：当日有已完成任务）

---

## 8. 手工验证

1. **前置准备**：确保至少有一个未完成任务，今天至少完成过一个番茄钟
2. **验证底部栏**：进入 todo 页 → 底部栏"今日专注"应与 focus 页统计一致（真实数据，非历史累计）
3. **验证 completedTasks 写入**：在 todo 页标记一个任务完成 → 进入 stats 页看"完成任务"是否 +1
4. **验证防重**：再次标记同一个已完成任务（重复勾选）→ stats 不应再 +1
5. **验证取消再完成**：取消任务完成后再标记完成 → stats 应 +1
6. **验证断网降级**：开启飞行模式 → 进入 todo 页 → 底部栏应显示 `--` 而非 `0h0m`，不崩溃
7. **验证 onShow 刷新**：从 todo 页跳到 focus 页完成一个番茄 → 返回 todo 页 → 底部栏数据应更新
