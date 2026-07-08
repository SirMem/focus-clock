# 已知问题 & 技术债务清单

> **目的**：对齐团队认知，明确当前代码库中已知的风险点和改进方向。
> **最后更新**：2026-07-08
> **维护规则**：修复某个问题后，将其移至文末「已修复」表并标注 commit；新增问题按严重程度插入对应章节。

---

## 总览

| 编号 | 严重程度 | 问题 | 涉及模块 | 状态 |
|------|---------|------|---------|------|
| P0-1 | 🔴 P0 | session/complete 无事务保护 | session.service | ✅ 已修复 |
| P0-2 | 🔴 P0 | session/complete 无防重复机制 | session.service + focus.js | ✅ 已修复 |
| P1-1 | 🟠 P1 | 前端计时器切后台不准 | focus.js | ✅ 已修复 |
| P1-2 | 🟠 P1 | _incrementTaskPomodoros 返回值不准 | session.service | ✅ 已修复 |
| P2-1 | 🟡 P2 | AI 教练非真正 AI | coach.service | 待决策 |
| P2-2 | 🟡 P2 | 统计模块 N+1 逐日查询 | stats.service + coach.service | ✅ 已修复 |
| P3-1 | 🟢 P3 | User 路由跳过 Service 层 | user.routes | ✅ 已修复 |
| P3-2 | 🟢 P3 | 错误处理不够精细 | index.js 全局兜底 | ✅ 已修复 |
| P3-3 | 🟢 P3 | 魔法数字散落 | session.repo 等 | ✅ 已修复 |

---

## 🔴 P0 — 致命风险

### P0-1：session/complete 没有事务保护

**位置**：`cloudfunctions/focus-api/services/session.service.js:58-101` (`completeSession` 方法)

**现状**：

```javascript
// 三步操作，没有任何事务包裹
const created = await this.sessionRepo.insert(sessionRecord);        // ① 插入 session
if (isPomodoro) {
  await this.dailySummaryRepo.upsert(openId, dateStr, {...});        // ② 更新日汇总
}
if (taskId) {
  task = await this._incrementTaskPomodoros(taskId, openId);         // ③ 递增任务番茄数
}
```

**后果**：
- 步骤① 成功、步骤② 失败 → session 已记录但日汇总没更新，统计对不上
- 步骤①+② 成功、步骤③ 失败 → session 和日汇总都写了，但任务番茄数没变
- 数据一旦不一致，修复只能手工查库

**根因**：微信云开发数据库支持 `startTransaction()`，但我们没有使用。

**修复方案**：

```javascript
const db = getDb();
const transaction = await db.startTransaction();
try {
  const created = await transaction.collection('sessions').add({ data: sessionRecord });
  if (isPomodoro) {
    // upsert 逻辑需改写为事务内手动处理
    await _upsertDailySummaryInTx(transaction, openId, dateStr, increments);
  }
  if (taskId) {
    await _incrementTaskPomodorosInTx(transaction, taskId, openId);
  }
  await transaction.commit();
  return { session: { _id: created.id, ...sessionRecord }, ... };
} catch (err) {
  await transaction.rollback();
  throw err;
}
```

**注意**：云开发事务 API 对集合操作有限制，`_.inc()` 等指令在事务内行为需实测验证。如果事务方案不可行，至少要在步骤②③失败时手动补偿删除步骤①的记录。

---

### P0-2：session/complete 没有防重复

**位置**：
- 后端：`cloudfunctions/focus-api/services/session.service.js:58` (`completeSession`)
- 前端：`pages/focus/focus.js`（完成按钮点击处理）

**现状**：
- 后端 `completeSession` **没有幂等键**，每次调用都新建一条 session
- 前端完成按钮**没有 loading 锁定**，用户可以快速连点

**后果**：用户快速连点两次"完成专注"→ 后端收到两次请求 → 插入两条完全相同的 session 记录 → 日汇总和任务番茄数都被 double count → 数据翻倍。

**修复方案（双层防护）**：

**前端（P0 必须）**：
```javascript
// focus.js — 完成按钮点击后立即锁定
data: {
  completing: false,  // 新增状态
},

async onComplete() {
  if (this.data.completing) return;   // 防连点
  this.setData({ completing: true });
  try {
    await wx.cloud.callFunction({ name: 'focus-api', data: { $url: 'session/complete', ... } });
  } finally {
    this.setData({ completing: false });
  }
}
```

**后端（P1 建议，更可靠）**：
- 方案 A（推荐）：在 session 文档中加入幂等键 `idempotencyKey`（前端传入 `startedAt + openId + mode` 组合的 hash），插入前先查是否存在
- 方案 B：利用数据库唯一索引（`_openid + startedAt + mode`），第二个插入自动失败

---

## 🟠 P1 — 较大风险

### P1-1：前端计时器不可靠（切后台/锁屏/接电话不准）

**位置**：`pages/focus/focus.js`（计时逻辑）

**现状**：

```javascript
// 当前方案：每秒 -1，切后台 setInterval 被暂停
this.timer = setInterval(() => {
  this.setData({ timeLeft: this.data.timeLeft - 1 });
}, 1000);
```

**后果**：
- 用户开始 25 分钟番茄钟 → 切到微信聊天 3 分钟 → 切回来 → 倒计时只过了几秒（因为小程序进入后台后 `setInterval` 被严重降频或暂停）
- 用户实际专注了 28 分钟，计时器才走到 0 → 统计数据失真
- 锁屏、接电话同样触发此问题

**根因**：微信小程序在后台时，JS 定时器会被大幅降频（可能几秒甚至几十秒才触发一次），`setInterval` 不可信赖。

**修复方案**：

第一梯队：纯前端 + 持久化存储（小程序最主流）
思路：虽然 JavaScirpt 变量在进程死亡后会丢失，但 wx.setStorageSync 的数据会留在手机本地。利用小程序的生命周期钩子来保存和恢复状态。


// 开始计时时
startTimer() {
  const startTime = Date.now();
  this.setData({ startTime, timeLeft: this.data.totalSeconds });
  wx.setStorageSync('pomodoro_state', {  // ← 存到本地
    startTime,
    totalSeconds: this.data.totalSeconds,
    status: 'running'
  });
  // 定时器照常用 Date.now() 方式...
}

// 小程序从后台切回前台时（用户重新打开）
wx.onShow(() => {
  const saved = wx.getStorageSync('pomodoro_state');
  if (saved && saved.status === 'running') {
    const elapsed = Math.floor((Date.now() - saved.startTime) / 1000);
    if (elapsed >= saved.totalSeconds) {
      // 已经超时了，触发完成
      this.onComplete();
    } else {
      // 恢复计时器，用原来的 startTime 继续
      this.setData({
        startTime: saved.startTime,
        timeLeft: saved.totalSeconds - elapsed
      });
      this.startTimer(); // 重新启动 setInterval
    }
  }
});
特点：

✅ 用户划掉小程序重新打开，时间不丢
✅ 用户故意退出再进想「逃时间」？存了 startTime，系统能算出真实耗时
✅ 不依赖后端，离线也能用
❌ 用户清除微信缓存/卸载重装 → 数据丢失（但概率低）

---

### P1-2：`_incrementTaskPomodoros` 返回值可能不准

**位置**：`cloudfunctions/focus-api/services/session.service.js:135-157`

**现状**：

```javascript
async _incrementTaskPomodoros(taskId, openId) {
  const taskRes = await db.collection('tasks').where({...}).get();

  if (taskRes.data.length === 0) return null;

  await db.collection('tasks').doc(taskId).update({
    data: { completedPomodoros: _.inc(1), ... },
  });

  // ⚠️ 这里：基于「更新前」的旧值 + 1，不是真实值
  return {
    _id: taskId,
    completedPomodoros: (taskRes.data[0].completedPomodoros || 0) + 1,
  };
}
```

**后果**：
- 单用户场景下结果正确
- 但如果有并发（同一 task 在极短时间内收到两次 complete），第二次调用的 `taskRes.data[0]` 仍是旧值，返回的 `completedPomodoros` 比实际少 1
- 虽然实际上微信小程序同一用户并发写冲突概率较低，但**代码逻辑不严谨**

**修复方案**：

```javascript
// 方案 A（简单）：更新后重新查询真实值
async _incrementTaskPomodoros(taskId, openId) {
  const taskRes = await db.collection('tasks').where({ _id: taskId, _openid: openId }).get();
  if (taskRes.data.length === 0) return null;

  await db.collection('tasks').doc(taskId).update({
    data: { completedPomodoros: _.inc(1), updatedAt: Date.now() },
  });

  // 更新后重新查询，拿到真实值
  const updated = await db.collection('tasks').doc(taskId).get();
  return { _id: taskId, completedPomodoros: updated.data.completedPomodoros || 0 };
}

// 方案 B（更简洁）：既然调用方不一定需要精确数字，直接返回 ok
return { _id: taskId, ok: true };
```

**推荐方案 A**，因为前端可能需要显示更新后的番茄数。

---

## 🟡 P2 — 中等风险

### P2-1：AI 教练不是真正的 AI

**位置**：`cloudfunctions/focus-api/services/coach.service.js`（整个评分和洞察引擎）

**现状**：

```javascript
// 评分引擎 — 纯 if/else 规则
function calcConsistency(weekData) {
  if (activeDays >= 5) return 100;
  if (activeDays >= 3) return 70;
  if (activeDays >= 1) return 40;
  return 0;
}

// 洞察生成 — 硬编码字符串模板
function generateInsights(score, weekData) {
  insights.push({
    type: 'achievement',
    icon: '🔥',
    text: '连续专注表现优秀，本周 5 天以上都完成了专注！',
  });
}
```

**后果**：
- 评分规则僵硬（如恰好在阈值边界，差1天分数跳跃 30 分）
- 洞察文本千篇一律，无个性化
- 命名为 "AI 教练" 但实际零 AI —— 标签具有误导性

**决策点**：**这不是 bug，是架构选择。** 需要产品 owner 决定：
- **短期（MVP）**：当前规则引擎足够，只需把名字改为「专注教练」，去掉 "AI" 误导
- **长期（v1.x）**：接入 LLM API（如 Claude API）生成个性化洞察，规则引擎仅做 fallback

**如果决定接入 LLM**：
- 在云函数中新增 `services/ai-engine.service.js`
- coach.service 调用 ai-engine 获取洞察，规则引擎作为离线/降级兜底
- 注意控制 API 调用成本和延迟（可加缓存，每天只生成一次）

---

### P2-2：统计模块逐日查询（N+1 问题）

**位置**：
- `cloudfunctions/focus-api/services/stats.service.js:68-98` (`getWeeklyStats`)
- `cloudfunctions/focus-api/services/stats.service.js:115-143` (`getMonthlyStats`)
- `cloudfunctions/focus-api/services/stats.service.js:155-170` (`getHeatmapData`)
- `cloudfunctions/focus-api/services/coach.service.js:227-245` (`_getLast7DaysData`)

**现状**：

```javascript
// getMonthlyStats：对每月每一天独立发起一次数据库查询
for (let d = 1; d <= totalDays; d++) {        // 31 天 × 1 次查询
  const record = await this.dailySummaryRepo.findByDate(openId, dateStr);
}

// getWeeklyStats：7 天 × 1 次查询
for (let i = 0; i < 7; i++) {
  const record = await this.dailySummaryRepo.findByDate(openId, dateStr);
}

// _getLast7DaysData（coach.service）：同样是 7 次独立查询
for (let i = 0; i < 7; i++) {
  const record = await this.dailySummaryRepo.findByDate(openId, dateStr);
}
```

**后果**：
- 月统计 = 31 次数据库查询串行执行
- 周统计 + 热力图 + AI 教练评分 = 每次各 7 次查询
- 云函数冷启动时延迟显著增加（每次 `findByDate` 都是独立网络 IO）
- 云数据库按请求量计费时成本更高

**修复方案**：

```javascript
// daily-summary.repo.js — 新增范围查询方法
async findByDateRange(openId, startDate, endDate) {
  const res = await this.collection.where({
    _openid: openId,
    date: this._.gte(startDate).and(this._.lte(endDate)),
  }).get();
  return res.data;  // 返回数组
}

// stats.service.js — 改为一次查询
async getMonthlyStats(openId) {
  const monthStr = getMonthStr();
  const [year, month] = monthStr.split('-').map(Number);
  const totalDays = getDaysInMonth(year, month);
  const startDate = `${monthStr}-01`;
  const endDate = `${monthStr}-${String(totalDays).padStart(2, '0')}`;

  // ✅ 一次查询替代 31 次
  const records = await this.dailySummaryRepo.findByDateRange(openId, startDate, endDate);

  // 构建 date → record 映射表
  const dateMap = {};
  for (const r of records) { dateMap[r.date] = r; }

  let totalFocusMinutes = 0, totalPomodoros = 0, activeDays = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
    const record = dateMap[dateStr];
    if (record) {
      totalFocusMinutes += record.focusMinutes || 0;
      totalPomodoros += record.pomodoroCount || 0;
      activeDays++;
    }
  }
  // ...
}
```

**同样改造** `getWeeklyStats`、`getHeatmapData`、`_getLast7DaysData`，全部从逐日查询改为一次范围查询。

---

## 🟢 P3 — 轻度风险

### P3-1：User 路由跳过 Service 层

**位置**：`cloudfunctions/focus-api/routes/user.routes.js`

**现状**：

```javascript
// 路由直接操作 Repo，没有 UserService
const repo = UserRepo.create();
const user = await repo.upsertUser(openId, {});       // user/login
const user = await repo.updateProfile(ctx.OPENID, ...); // user/profile/update
const settings = await repo.getSettings(ctx.OPENID);   // user/settings/get
await repo.updateSettings(ctx.OPENID, settings);        // user/settings/update
const user = await repo.findByOpenId(ctx.OPENID);      // user/info
```

对比其他模块：
- `task.routes.js` → `TaskService` → `TaskRepo`
- `session.routes.js` → `SessionService` → `SessionRepo`
- `coach.routes.js` → `CoachService` → `CoachRepo`
- `user.routes.js` → ~~UserService~~ → `UserRepo` ❌

**后果**：
- 架构不一致，新人困惑
- 如果后续 user 模块需要业务逻辑（如更新头像后同步清理 CDN 缓存），无处安放
- 路由层代码注释写的是「操作简单直接，不需要中间业务逻辑层」，但这是一种**偷懒的辩解**

**修复方案**：
1. 新建 `cloudfunctions/focus-api/services/user.service.js`
2. 将路由中的业务判断（如 `USER_NOT_FOUND` 处理、默认 settings 合并）下沉到 Service
3. 路由层只做参数校验 + 调用 Service + 返回

```javascript
// user.service.js
class UserService {
  constructor(userRepo) { this.userRepo = userRepo; }
  static create() { return new UserService(UserRepo.create()); }

  async login(code) { /* ... */ }
  async updateProfile(openId, profile) { /* ... */ }
  async getSettings(openId) { /* ... */ }
  async updateSettings(openId, settings) { /* ... */ }
  async getInfo(openId) { /* ... */ }
}
```

---

### P3-2：错误处理不够精细

**位置**：`cloudfunctions/focus-api/index.js:46-51`

**现状**：

```javascript
// 全局兜底 — 所有未捕获异常 → 统一返回 "服务器内部错误"
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('[Unhandled Error]', err);
    ctx.body = { code: -1, message: '服务器内部错误' };  // ⚠️ 用户看不到真实原因
  }
});
```

**后果**：
- 数据库连接失败、字段校验失败、权限不足……全部返回同一句话
- 前端无法根据错误类型做不同处理（如 401 跳登录、400 提示用户修正输入）
- 排查问题时只能看云函数日志，用户体验差

**修复方案**：

```javascript
// 定义业务错误类
class AppError extends Error {
  constructor(code, message, httpStatus = 500) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// 全局错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof AppError) {
      ctx.body = { code: err.code, message: err.message };
    } else if (err.message === 'USER_NOT_FOUND') {
      ctx.body = { code: 404, message: '用户不存在' };
    } else {
      console.error('[Unhandled Error]', err);
      ctx.body = { code: -1, message: '服务器内部错误' };
    }
  }
});
```

---

### P3-3：魔法数字散落

**位置**：
- `cloudfunctions/focus-api/repositories/session.repo.js:115` — `9e15`
- `cloudfunctions/focus-api/services/coach.service.js:24-64` — 评分阈值 `5/3/1`, `20/10/5/1`, `0.6/0.3`

**现状**：

```javascript
// session.repo.js
const lte = endDate
  ? new Date(endDate + 'T23:59:59.999').getTime()
  : 9e15;  // ⚠️ 没有注释，阅读者不知道这是什么

// coach.service.js
if (activeDays >= 5) return 100;  // ⚠️ 为什么是 5？为什么是 100？
if (total >= 20) return 100;      // ⚠️ 为什么是 20？
```

**修复方案**：

```javascript
// config/constants.js
module.exports = {
  FAR_FUTURE_TIMESTAMP: 9e15,  // 远大于任何合理 Unix 时间戳，用于表示「无上限」的 lte
  COACH: {
    CONSISTENCY: { HIGH: 5, MID: 3, LOW: 1 },
    VOLUME: { HIGH: 20, MID: 10, LOW: 5, MIN: 1 },
    BALANCE: { HIGH_RATIO: 0.6, MID_RATIO: 0.3 },
    SCORE: { MAX: 100, HIGH: 70, MID: 40, LOW: 20, MIN: 0, FALLBACK: 30 },
    WEIGHTS: { consistency: 0.4, volume: 0.35, balance: 0.25 },
  },
};
```

---

## 不在本文档范围内的问题

以下问题**不在此 backlog 中**，因为它们属于新功能开发而非现有代码缺陷：

- 数据持久化（wx.setStorage）—— 功能缺失，非 bug
- 音效选择功能 —— 功能未完成
- 任务与番茄钟前端联动 —— 交互未实现
- 统计/日记/教练页面在小程序端的实现 —— 页面尚不存在
- 单元测试覆盖率为 0 —— 需单独讨论测试策略

---

## 修复优先级建议

```
Round 1（✅ 已完成 2026-07-08）:
  ├── P0-1: 事务保护（补偿模式）
  ├── P0-2: 防重复（前端按钮锁定 + 后端幂等键）
  ├── P1-1: 计时器改用 Date.now()
  └── P1-2: _incrementTaskPomodoros 返回真实值

Round 2（✅ 已完成 2026-07-08）:
  ├── P2-2: 统计 N+1 → 范围查询
  ├── P3-1: User Service 层
  ├── P3-2: 错误处理精细化
  └── P3-3: 魔法数字常量化

Round 3（待决策）:
  └── P2-1: AI 教练决策（改名 or 接 LLM）
```

---

## 已修复

| 编号 | 严重程度 | 问题 | 涉及模块 | 修复方式 | 日期 |
|------|---------|------|---------|---------|------|
| P0-1 | 🔴 P0 | session/complete 无事务保护 | session.service | 补偿模式：步骤②③失败时自动删除步骤①的 session 记录 | 2026-07-08 |
| P0-2 | 🔴 P0 | session/complete 无防重复 | session.service + focus.js | 前端 `completing` 状态锁 + 后端 `idempotencyKey` 查重 | 2026-07-08 |
| P1-1 | 🟠 P1 | 前端计时器切后台不准 | focus.js | 改用 `Date.now()` 墙钟计时 + `wx.setStorageSync` 持久化 + `onShow` 恢复 | 2026-07-08 |
| P1-2 | 🟠 P1 | _incrementTaskPomodoros 返回值不准 | session.service | `_.inc(1)` 后重新查询数据库获取真实值 | 2026-07-08 |
| P2-2 | 🟡 P2 | 统计模块 N+1 逐日查询 | stats.service + coach.service + daily-summary.repo | 新增 `findByDateRange()` 方法，周/月/热力图全部改为一次范围查询 | 2026-07-08 |
| P3-1 | 🟢 P3 | User 路由跳过 Service 层 | user.routes + user.service | 新建 `UserService`，code2Session / upsert / profile 校验下沉到 Service 层 | 2026-07-08 |
| P3-2 | 🟢 P3 | 错误处理不够精细 | index.js + app-error.js | 新增 `AppError` 业务错误类，全局中间件区分 AppError / USER_NOT_FOUND / 未预期错误 | 2026-07-08 |
| P3-3 | 🟢 P3 | 魔法数字散落 | session.repo + coach.service + constants.js | 新建 `config/constants.js`，集中管理评分阈值、权重、时间戳常量 | 2026-07-08 |
