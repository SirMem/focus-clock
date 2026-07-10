# 13-ai-score-persist — 统计页 AI 评分：从实时计算到持久化写入

> 状态: 📋 Spec 待审核
> 依赖: `09-coach-p0.md`（coach/score 规则引擎已上线）、`04-focus-session.md`（session/complete 链路已通）
> 目标: 将 Coach 规则引擎评分写入 `daily_summaries.aiScore`，使统计页 AI 评分卡展示真实数据

---

## 1. 当前问题

### 断裂链路

```
coach/score（实时算，不存数据库）
  → 教练页：显示正常 ✅

stats/today → daily_summaries.aiScore（无人写入）
  → 统计页评分卡：永远 0 ❌
```

### 根因

`daily_summaries` 集合 Schema 中有 `aiScore` 字段，但没有任何代码往这个字段写值：
- `session/complete` 的 `dailySummaryRepo.upsert()` 只传了 `focusMinutes` 和 `pomodoroCount`
- `CoachService.getScore()` 能算分但只返回前端，不存数据库
- 统计页读 `todayStats.aiScore` 永远是 `undefined`

---

## 2. 方案概述

在 `session/complete` 主流程之后，追加一次 Coach 评分计算，将结果写入当日 `daily_summaries` 的 `aiScore` 字段。

### 核心约束

- **不阻塞主流程**：评分写入失败不应导致 `session/complete` 返回错误，不影响 session 记录和日汇总的写入
- **不引入外部依赖**：评分是纯规则引擎（3 维度加权），不调用 LLM/外部 API
- **覆盖而非累加**：每次评分是实时重新计算的绝对值，不应与旧的 `aiScore` 值累加

---

## 3. 逻辑交互

### 完整调用链

```
session/complete 请求
  │
  ├─ 1. idempotencyKey 幂等检查
  ├─ 2. 插入 session 记录
  ├─ 3. upsert 日汇总（focusMinutes + pomodoroCount）
  ├─ 4. 如果有关联 taskId，递增任务的 completedPomodoros
  ├─ 5. 查询当日 sessions 计算累计统计
  │
  └─ 🆕 6. 异步写 aiScore（不阻塞 return）
       ├─ CoachService.getScore(openId)
       │    └─ 内部读 daily_summaries 近 7 天记录
       │    └─ calcConsistency → calcVolume → calcBalance → 加权总分
       └─ daily_summaries 当日记录.aiScore = score（原地赋值）
```

### 步骤 6 的失败处理

```
updateAiScore 失败
  └─ console.warn 记录日志
  └─ 不 throw → 主流程已 return，前端无感知
```

---

## 4. 改动范围

| 层 | 文件 | 操作 | 职责 |
|---|------|------|------|
| Repo | `daily-summary.repo.js` | 🆕 新增方法 | 当日记录的 `aiScore` 原地赋值（非 `_.inc()`） |
| Service | `session.service.js` | 🔧 扩展方法 | `completeSession()` 步骤 5 之后追加异步评分写入 |

`coach.service.js`、`stats.service.js`、路由层不变。

---

## 5. BDD 场景

### 场景 1: 完成番茄后评分写入成功

```
Given 用户完成了 1 个番茄钟（session/complete 返回成功）
When session/complete 处理完毕
Then daily_summaries 当日记录存在 aiScore 字段
  And aiScore 是一个 0-100 的整数
  And 统计页 stats/today 返回的 aiScore 不为空
```

### 场景 2: 多次番茄评分覆盖更新

```
Given 用户当日已有 aiScore = 40 的记录
When 用户又完成一个番茄
Then daily_summaries 当日 aiScore 被重新计算并覆盖新值
  And 新值不等于旧值（当日更多数据使评分变化）
```

### 场景 3: 评分写入失败不阻塞主流程

```
Given daily_summaries 集合不可写（权限/网络问题）
When 用户完成一个番茄
Then session/complete 仍然返回 code: 0
  And session 记录已成功插入
  And 前端收到正常响应（无 toast、无报错）
  And 云函数日志包含 aiScore 写入失败的 warn 记录
```

### 场景 4: 统计页展示真实评分

```
Given daily_summaries 当日已有 aiScore = 75
When 用户进入统计页
Then 评分卡片显示 75 分
  And 等级显示"进阶"（≥61 → 达人，≥41 → 进阶，≥21 → 入门）
  And 表情符号对应分数区间（≥90 🎯、≥70 👍、≥50 💪、其他 📊）
```

---

## 6. 验收检查

- [ ] `daily-summary.repo.js` 新增 `updateAiScore(openId, date, score)` 方法
- [ ] `session.service.js` 的 `completeSession()` 末尾追加异步评分写入
- [ ] 评分写入失败不 throw，不阻塞 `session/complete` 返回
- [ ] `stats/today` 返回的 `aiScore` 不为 `undefined`
- [ ] 统计页评分卡片显示真实分数和对应等级
- [ ] 多次完成番茄，`aiScore` 持续更新（覆盖而非累加）
