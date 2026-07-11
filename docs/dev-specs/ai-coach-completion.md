# Spec: AI 教练页功能完善

> 状态: Draft · 当前迭代
> 目标版本: v1.4.0
> 后端状态: DEEPSEEK_API_KEY 已配置于云环境

---

## Problem Statement

AI 教练页（`pages/coach/coach`）从个人页入口跳转进入，目前存在多处功能不完整的问题：

1. **导航断头路**：页面没有返回按钮，从个人页 `wx.redirectTo` 进入后无法回退
2. **吉祥物缺失**：评分卡右侧的熊插画使用 `🤖` emoji 占位，不是设计稿中的插图
3. **成就勋章孤岛**：页面展示的勋章从规则引擎的 `insights` 文本中抠取 3 条展示，未接入完整的 `achievement/list` API（12 条规则引擎）
4. **个人页评分 badge 写死**：个人页功能菜单的 AI 教练条目右侧 badge 永远显示 "92分"，未从 `coach/score` 接口获取真实评分
5. **周报预览按钮无效**："查看完整周报" 使用 Toast 占位
6. **成就查看按钮无效**："查看全部" 使用 Toast 占位
7. **AI 教练设置按钮无效**：使用 Toast 占位
8. **历史建议列表永远为空**：`coachingHistory` 初始化为 `[]` 且从未填充
9. **建议采纳未持久化**：`onAcceptSuggestion` 仅修改本地状态，不保存到后端

后端 AI 功能已具备完整链路（DeepSeek 客户端、周报 Prompt 模板、上下文收集、规则引擎降级），但前端页面尚未完全利用。

---

## Solution

分两个阶段修复上述问题：

### 阶段一：基础交互修复（导航 + 数据挂接）

修复返回按钮、个人页 badge 动态化、成就勋章接入真实 API、吉祥物插图。这些改动涉及的文件范围可控，不依赖后端新增接口。

### 阶段二：扩展功能补全（详细视图 + 持久化）

实现周报详情页、历史建议持久化、设置页。这些改动可能需要后端新增少量接口。

---

## User Stories

### 导航与交互

1. As a 用户, I want to **在 AI 教练页看到返回按钮**，点击后返回个人页， so that 导航路径完整
2. As a 用户, I want to **在 AI 教练评分卡看到熊插画**而非 emoji， so that 页面视觉与设计稿一致

### 评分与 badge

3. As a 用户, I want to **在个人页功能菜单看到真实的 AI 教练评分**（随每周数据动态变化）， so that 不必点进去就能了解本周效率
4. As a 用户, I want to **在 AI 教练页看到本周效率评分**（基于规则引擎计算的综合分数和等级）， so that 快速了解本周表现

### 成就勋章

5. As a 用户, I want to **在 AI 教练页看到我从成就系统获得的真实勋章**（基于 `achievement/list` 的 12 条规则判定）， so that 看到的是完整准确的成就状态
6. As a 用户, I want to **点击"查看全部"跳转到个人页的成就勋章子视图**， so that 可以浏览完整的勋章列表

### 周报与趋势

7. As a 用户, I want to **在 AI 教练页看到 AI 生成的周报**（调用 `coach/weekly-report`，由 DeepSeek LLM 生成个性化文案）， so that 获得有洞察力的每周总结
8. As a 用户, I want to **点击"查看完整周报"看到完整的周报内容**（替代当前 Toast 占位）， so that 可以阅读 AI 生成的全部周报文案
9. As a 用户, I want to **在 AI 教练页看到本周专注趋势柱状图**（展示 7 天数据）， so that 直观了解每天的专注时长变化

### 建议与历史

10. As a 用户, I want to **在 AI 教练页看到今日建议**（来自 `coach/tip` 或 AI 周报的建议）， so that 获得可执行的建议
11. As a 用户, I want to **点击"采纳建议"后**状态持久化到后端， so that 下次进入不会再看到同一条建议
12. As a 用户, I want to **看到历史建议列表**（之前采纳或浏览过的建议）， so that 可以回顾之前的改进方向
13. As a 用户, I want to **点击 AI 教练设置进入设置页**（替代当前 Toast 占位）， so that 可以配置教练偏好

---

## Implementation Decisions

### 1. 导航修复

在 coach.wxml 的 nav-bar 左侧，将 `nav-placeholder` 替换为返回按钮：

```html
<view class="nav-left" bind:tap="onNavigateBack">
  <t-icon name="chevron-left" size="36rpx" color="#1A1A2E" />
</view>
```

`onNavigateBack` 方法使用 `wx.navigateBack()` 返回上一个页面（个人页）。由于进入 coach 页使用的是 `wx.redirectTo`（页面栈替换），改为 `wx.navigateTo` 或在生命周期中处理后退逻辑。

**决策**：将 profile.js 中跳转 coach 的方式从 `wx.redirectTo` 改为 `wx.navigateTo`，这样就可以用 `wx.navigateBack()` 返回。

### 2. 吉祥物插图

将 `🤖` emoji 替换为熊插画图片。图片资源放入 `pages/coach/` 目录或使用在线图片 CDN。使用 `<image>` 标签替代当前 `<text>`。

**P0 方案**：使用微信云存储托管熊插画图片（上传到云存储获取 fileID），或使用 base64 内嵌 SVG（如果文件不大）。

### 3. 成就勋章接入真实 API

当前 `buildAchievements()` 从 `coach/score` 的 `insights` 中抠取文字，改为直接调用 `achievement/list`。

在 `_loadCoachData()` 的并行 API 调用中增加 `coachAPI.achievements()`：

```javascript
const [scoreRes, tipRes, weeklyRes, reportRes, achievementRes] = await Promise.all([
  coachAPI.score(),
  coachAPI.tip(),
  statsAPI.weekly(),
  coachAPI.weeklyReport(),
  coachAPI.achievements(),   // 新增
]);
```

从 `achievementRes` 中取已获得的勋章（`earned: true`）展示在页面上。点击"查看全部"跳转到个人页的成就勋章子视图。

**交互**：点击"查看全部" → `wx.navigateTo` / 发事件给个人页 → 切换到 achievements 子视图。

### 4. 个人页评分 badge 动态化

`pages/profile/profile.js` 中 `featureMenu` 的 `badge: '92分'` 改为从 `_loadStats()` 结果中动态构建。

在 `_loadProfile()` 或 `_loadStats()` 中，调用 `coachAPI.score()` 获取真实评分，然后更新 featureMenu：

```javascript
const scoreRes = await coachAPI.score();
const realScore = scoreRes.code === 0 ? scoreRes.data.score : null;
// 更新 featureMenu 中 coach 项的 badge
```

### 5. 周报详情

P0 版本：在当前页面使用 `wx.showModal` 展示完整周报内容（替代 Toast）。
P1 版本：新增一个独立的周报详情页或弹窗组件。

### 6. 历史建议持久化

后端新增接口 `coach/suggestion/save` 和 `coach/suggestion/list`：

- `suggestion/save`: `{ content: string, accepted: boolean }` → 写入 `suggestions` 集合
- `suggestion/list`: 返回用户历史建议列表

P0 版本可以先用本地 `wx.setStorageSync` 存储采纳状态，不做后端持久化。

### 7. 新增数据库集合

| 集合 | 字段 |
|------|------|
| `suggestions` | `{ _openid, content, accepted, createdAt }` |

### 8. 无需改动的后端

以下后端模块已验证完整，本 spec **不需要改动**：
- `coach/score` — 规则引擎评分
- `coach/tip` — 规则引擎建议
- `coach/weekly-report` — AI 周报（含 DeepSeek LLM 调用 + 规则引擎降级）
- `achievement/list` — 12 条成就规则引擎（我们刚写完的）

---

## Testing Decisions

验收方式与之前的 tickets 一致（无测试框架，手动验证）：

**验收方法**:
1. 微信开发者工具中逐条验证 User Stories
2. 云函数日志检查 AI 周报是否成功调用 DeepSeek（`generatedBy: 'ai'`）
3. 云开发控制台数据库检查 `suggestions` 集合记录

**验收清单**:

| Story | 验证方法 |
|-------|---------|
| #1 | 从个人页进教练页→看到返回按钮→点击返回个人页 |
| #2 | 评分卡右侧显示熊插画而非 🤖 |
| #3 | 个人页功能菜单显示真实评分（非"92分"硬编码） |
| #4 | 教练页评分卡展示后端返回的 score + level |
| #5 | 教练页成就区显示真实已获得勋章 |
| #6 | 点击"查看全部"→跳转到个人页成就子视图 |
| #7 | 周报卡片显示 AI 生成的文案，右上角显示 "AI 生成" 标签 |
| #8 | 点击"查看完整周报"→展示完整周报内容 |
| #9 | 柱状图展示 7 天数据 |
| #10 | 今日建议区展示后端返回的建议文案 |
| #11 | 采纳建议后状态持久化，刷新后可见 |
| #12 | 历史建议列表不为空 |
| #13 | 点击"AI 教练设置"进入设置页 |

---

## Out of Scope

- **AI 教练设置页的完整功能**（通知频率、AI 开关等）— P1，本 spec 只做入口打通，设置页内容为 P1
- **熊插画的视觉设计**（绘制/设计）— 假设设计稿已提供熊插画资源，本 spec 只做前端集成
- **coach/correlation 情绪关联分析的前端展示** — 后端已有，但前端暂不展示
- **coach/smart-tip 智能建议** — 后端已有，前端暂不接入
- **历史建议的云同步** — P0 用本地 Storage 足够

---

## Further Notes

- `DEEPSEEK_API_KEY` 已配置在微信云环境变量中，`coach/weekly-report` 的 AI 路径应可用
- 后端 AI 客户端连接的是 `https://opencode.ai/zen/go`，模型 `deepseek-chat`
- 周报 Prompt 模板在 `cloudfunctions/focus-api/ai/prompts/weekly-report.js`，数据上下文在 `ai/context/weekly-context.js`
- 成就勋章规则引擎在 `achievement.service.js`，12 条规则从 `sessions` + `daily_summaries` 聚合数据
- 通过 `wx.redirectTo` 改为 `wx.navigateTo` 来解决返回导航，需确认不会导致页面栈超过 10 层上限（个人页→教练页→其他页，最多 2 层）
