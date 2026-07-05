# Issue #6: Coach AI 教练模块

> **认领人**: @待定
> **状态**: 🔲 待开发
> **预估工时**: 3h
> **标签**: `module/coach`, `priority/p2`

---

## 概要

实现 AI 教练评分和建议接口。当前为 **v1 基础版**，基于用户历史数据做规则驱动评分，暂不接入外部 LLM API。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §7` | 接口入参/出参定义 |
| `pages/focus/focus.js` | AI_TIPS 数组（现有前端提示文案）|

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/services/coach.service.js
  cloudfunctions/focus-api/repositories/session.repo.js    # 若之前未创建，仅读取查询

需要修改:
  cloudfunctions/focus-api/routes/coach.routes.js
```

## 重要说明

- **v1 不接入外部 LLM**，评分和洞察基于规则计算
- Coach 模块可以没有独立的 Repo，直接复用 `session.repo` 和 `daily-summary.repo`
- 如果将来接入 LLM API（如 DeepSeek / 文心），只在 `coach.service.js` 中增加调用逻辑

## 详细实现要求

### 1. `services/coach.service.js`

**方法**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法 |
| `getScore(openId)` | 计算综合评分和洞察 |
| `getTip(openId)` | 生成今日建议 |

#### `getScore` 实现

评分基于三个维度，各 0-100 分，加权平均得总分：

| 维度 | 权重 | 计算方式 |
|------|------|----------|
| 持续度 Consistency | 40% | 最近 7 天有 ≥5 天专注 → 100, ≥3 天 → 70, ≥1 天 → 40, 0 → 0 |
| 专注量 Volume | 35% | 最近 7 天总番茄数: ≥20 → 100, ≥10 → 70, ≥5 → 40, ≥1 → 20, 0 → 0 |
| 均衡度 Balance | 25% | 每天番茄数标准差越小越高（简单版: 7 天内每天 ≥2 个 → 100, ≥1 个 → 60, 否则 30) |

**等级映射**：

| 分数范围 | 等级 |
|---------|------|
| 0-20 | '新手' |
| 21-40 | '入门' |
| 41-60 | '进阶' |
| 61-80 | '达人' |
| 81-100 | '大师' |

**洞察生成**（Insights）：

基于用户数据生成 2-4 个洞察条目，类型包括：

- `achievement`：成就类（如"今日完成 4 个番茄，超过平均水平"）
- `improvement`：改进类（如"建议每 25 分钟专注后休息 5 分钟"）
- `trend`：趋势类（如"本周专注时长比上周提升 20%"）
- `tip`：通用建议（从 `focus.js` 的 AI_TIPS 中选取）

**实现方式**：简单的 if/else 规则 + 模板字符串，不做 NLP。

#### `getTip` 实现

- 查询用户今日番茄数和近 7 天日均番茄数
- 根据数据生成建议文案
- 返回 `{ tip, context }`

**规则示例**：

```
if todayPomodoros === 0 → "今天还没有开始专注，设定一个任务开始第一个番茄吧"
if todayPomodoros < weeklyAverage → "今日进度略慢于平均水平，加油赶上！"
if todayPomodoros >= weeklyAverage → "今日表现良好，保持节奏！"
if todayPomodoros >= dailyGoal → "太棒了！已完成今日目标 🎉"
```

### 2. `routes/coach.routes.js`

两个路由，直接调用 Service：

```javascript
const CoachService = require('../services/coach.service');
const { succ } = require('../middleware/response');

module.exports = (app) => {
  app.router('coach/score', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getScore(ctx.OPENID);
    succ(ctx, result);
  });

  app.router('coach/tip', async (ctx) => {
    const service = CoachService.create();
    const result = await service.getTip(ctx.OPENID);
    succ(ctx, result);
  });
};
```

## 后端无需创建 api/coach.api.js

AI 教练的 API 调用在前端已通过 `focus.js` 中的 `AI_TIPS` 常量实现。后端接口准备好后，前端再创建调用封装。

## 验收标准

- [ ] `coach/score` 在用户有数据时返回合理评分和 ≥2 条洞察
- [ ] `coach/score` 在用户无数据时返回 0 分和默认提示
- [ ] `coach/tip` 根据用户当日数据返回上下文相关的建议
- [ ] 评分等级映射正确

## 后续扩展

当决定接入 LLM API 时：
1. 在 `coach.service.js` 中新增 `callLLM(prompt)` 私有方法
2. 将用户数据组装为 prompt
3. 解析 LLM 返回结果替代规则逻辑
4. 新增依赖（如 `axios`）在 `package.json` 中声明
