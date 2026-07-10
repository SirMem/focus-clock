# 12-ai-card-enhancement — Focus 页 AI 教练卡片：从硬编码轮播到 LLM 数据驱动

> 状态: 🚧 需实现
> 依赖: `09-coach-p0.md`（规则引擎已上线）
> 目标: 将 focus 页 AI 教练卡片从 **6 条硬编码文案轮播** 升级为 **LLM 基于真实专注数据生成的个性化建议**

---

## 1. 当前问题

### Focus 页 AI 教练卡片现状

```js
// focus.js 第 26-33 行 —— 硬编码文案
const AI_TIPS = [
  '番茄工作法能帮你保持专注…',
  '研究表明，短暂休息能提升大脑效率47%…',
  // ... 共 6 条固定文案
];

// focus.js 第 349-351 行 —— 完成一轮后机械旋转
if (isFocus) {
  const tipIndex = (this.data.tipIndex + 1) % AI_TIPS.length;
  this.setData({ currentTip: AI_TIPS[tipIndex], tipIndex });
}
```

**核心问题**：文案与用户实际数据完全无关（比如"今日已完成3个番茄"是假的）。

---

## 2. 方案概述

```
focus.js onLoad / 完成番茄
  → coachAPI.smartTip()
    → coach/smart-tip (后端)
      → _getLast7DaysData() → 本周专注数据
      → LLM (DeepSeek) 生成建议
      → 返回 { tip, generatedBy }
    → setData({ currentTip, aiGeneratedBy })
```

**降级链**：LLM 失败 → 规则引擎 `getTip()` → 硬编码兜底

---

## 3. 改动文件

| 层 | 文件 | 操作 |
|---|---|---|
| 后端 | `cloudfunctions/focus-api/services/coach.service.js` | 新增 `getSmartTip(openId)` 方法 |
| 后端 | `cloudfunctions/focus-api/routes/coach.routes.js` | 新增 `coach/smart-tip` 路由 |
| 前端 | `miniprogram/api/coach.api.js` | 新增 `smartTip()` 方法 |
| 前端 | `pages/focus/focus.js` | import coachAPI，新增 `_loadCoachData()`，删除 `AI_TIPS` / `tipIndex` |
| 前端 | `pages/focus/focus.wxml` | AI 卡片 badge 动态显示生成来源 |
| 前端 | `pages/focus/focus.wxss` | 新增 badge 状态样式 |

---

## 4. 后端实现

### 4.1 `coach.service.js` — 新增 `getSmartTip()`

数据源使用已有的 `_getLast7DaysData()`（只需 `dailySummaryRepo`，一次范围查询，不引入 `collectWeeklyContext` 的 5 repo 依赖）。

```js
/**
 * AI 智能建议 — 基于本周专注数据 + LLM 生成个性化提示
 *
 * 降级链：LLM → getTip() 规则引擎 → 硬编码兜底
 *
 * @param {string} openId
 * @returns {Promise<{tip: string, generatedBy: 'ai'|'rule'|'fallback'}>}
 */
async getSmartTip(openId) {
  try {
    // ① 获取本周数据（已有方法，7 天范围查询）
    const weekData = await this._getLast7DaysData(openId);
    const totalPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
    const totalFocusMinutes = weekData.reduce((s, d) => s + d.focusMinutes, 0);
    const activeDays = weekData.filter(d => d.focusMinutes > 0).length;

    // 今日数据
    const todayStr = getDateStr();
    const todayData = weekData.find(d => d.date === todayStr) || { pomodoroCount: 0, focusMinutes: 0 };

    // 用户设置
    const user = await this.userRepo.findByOpenId(openId);
    const dailyGoal = user?.settings?.dailyGoal || 4;

    // ② 构建 prompt
    const systemPrompt = `你是一个专注力教练。根据用户的专注数据，给出一句 10-30 字的简短、鼓励性建议。
回复必须是纯 JSON，不要 markdown 标记：
{"tip": "建议文案"}

规则：
- 表现好（日均番茄 >= 目标）：给予表扬，建议挑战更高
- 表现一般：给出具体可操作的小改进建议
- 今日 0 番茄：鼓励从第一个番茄开始
- 口语化、温暖，禁止使用"根据您的数据"这类 AI 味表达`;

    const userPrompt = `本周数据：
- 总番茄数：${totalPomodoros} 个
- 总专注分钟：${totalFocusMinutes} 分钟
- 活跃天数：${activeDays}/7
- 今日番茄：${todayData.pomodoroCount} 个
- 今日目标：${dailyGoal} 个
- 日均番茄：${Math.round(totalPomodoros / 7)} 个

请给我一句简短的专注建议。`;

    // ③ 调用 LLM
    const result = await this.aiClient.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    // ④ 解析（兼容 markdown code fence）
    let content = result.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM 返回无 JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    return { tip: parsed.tip || '继续保持专注的节奏！', generatedBy: 'ai' };
  } catch (err) {
    console.warn('[SmartTip] LLM 失败，降级规则引擎:', err.message);
    return this._fallbackSmartTip(openId);
  }
}

/**
 * 降级：规则引擎 → 硬编码
 */
async _fallbackSmartTip(openId) {
  try {
    const result = await this.getTip(openId);
    return { tip: result.tip, generatedBy: 'rule' };
  } catch (err) {
    return {
      tip: '番茄工作法能帮你保持专注，每25分钟全力投入，休息时彻底放松。',
      generatedBy: 'fallback',
    };
  }
}
```

### 4.2 `coach.routes.js` — 新增路由

```js
// coach/smart-tip
app.router('coach/smart-tip', async (ctx) => {
  const service = CoachService.create();
  const result = await service.getSmartTip(ctx.OPENID);
  succ(ctx, result);
});
```

---

## 5. 前端实现

### 5.1 `coach.api.js` — 新增 `smartTip()`

```js
/**
 * AI 智能建议（LLM 生成，失败时降级到规则引擎）
 * @returns {Promise<{code: number, data: {tip: string, generatedBy: string}}>}
 */
smartTip() {
  return callAPI('coach/smart-tip');
},
```

### 5.2 `focus.js` — 核心改动

**新增 import**：
```js
const coachAPI = require('../../miniprogram/api/coach.api');
```

**data 新增字段**（替换 `tipIndex`）：
```js
aiGeneratedBy: '',  // 'ai' | 'rule' | 'fallback' | ''
```

**新增方法**：
```js
async _loadCoachData() {
  try {
    const res = await coachAPI.smartTip();
    if (res.code === 0 && res.data) {
      this.setData({
        currentTip: res.data.tip,
        aiGeneratedBy: res.data.generatedBy || '',
      });
    }
  } catch (err) {
    console.warn('[AICard] smartTip 调用失败:', err);
    // 保持现有 tip 不变，不崩溃
  }
},
```

**onLoad 中添加**：
```js
await Promise.all([
  this._loadTodayStats(),
  this._loadAvailableTasks(),
  this._loadCoachData(),  // 🆕
]);
```

**_onTimerComplete 中替换硬编码轮播**（第 349-351 行）：
```js
// 旧代码删除：
// const tipIndex = (this.data.tipIndex + 1) % AI_TIPS.length;
// this.setData({ currentTip: AI_TIPS[tipIndex], tipIndex });

// 新代码：
if (isFocus) {
  this._loadCoachData();
}
```

**删除**：`AI_TIPS` 常量（第 26-33 行）和 `data.tipIndex` 字段（第 66 行）。

### 5.3 `focus.wxml` — badge 动态化

```html
<!-- 旧: <view class="ai-badge">智能建议</view> -->
<view class="ai-badge {{aiGeneratedBy === 'ai' ? 'ai-badge-ai' : aiGeneratedBy === 'rule' ? 'ai-badge-rule' : ''}}">
  <block wx:if="{{aiGeneratedBy === 'ai'}}">AI 建议</block>
  <block wx:elif="{{aiGeneratedBy === 'rule'}}">智能建议</block>
  <block wx:else>专注指南</block>
</view>
```

### 5.4 `focus.wxss` — 新增 badge 状态

```css
.ai-badge-ai { background: linear-gradient(135deg, #E8F0FE, #D2E3FC); color: #1A73E8; }
.ai-badge-rule { background: #F5F5F5; color: #8A8A9A; }
```

---

## 6. 降级链

```
coach/smart-tip
  ├─ LLM 成功 → { tip: "AI 生成", generatedBy: 'ai' }
  ├─ LLM 失败 → getTip() 规则引擎 → { tip: "规则生成", generatedBy: 'rule' }
  └─ 规则引擎也失败 → 硬编码兜底 → { tip: "默认文案", generatedBy: 'fallback' }
```

---

## 7. BDD 场景

### 场景 1: 有数据的用户看到 LLM 建议
```
Given 用户本周有专注记录，DeepSeek API 可用
When 进入 focus 页
Then AI 卡片显示 LLM 生成的个性化建议
  And badge 显示 "AI 建议"（蓝色）
```

### 场景 2: LLM 不可用时降级规则引擎
```
Given DeepSeek API 返回错误
When 进入 focus 页
Then AI 卡片显示规则引擎生成的建议
  And badge 显示 "智能建议"
```

### 场景 3: 全部不可用时兜底
```
Given 网络断开，规则引擎也失败
When 进入 focus 页
Then AI 卡片显示默认鼓励文案（不白屏）
```

### 场景 4: 完成番茄后自动刷新
```
Given 用户完成一个番茄
When session 保存成功
Then AI 卡片自动刷新为最新建议
```

---

## 8. 验收检查

- [ ] focus 页 AI 卡片不再使用硬编码 `AI_TIPS`
- [ ] `currentTip` 来自后端 `coach/smart-tip` 接口
- [ ] badge 根据 `generatedBy` 动态显示（AI 建议 / 智能建议 / 专注指南）
- [ ] 完成番茄后卡片自动刷新
- [ ] LLM 失败 → 规则引擎兜底，不崩溃
- [ ] 规则引擎失败 → 硬编码兜底，不崩溃

---

## 9. 手工验证

1. 进入 focus 页，看 AI 卡片是否显示建议（非硬编码轮播）
2. 完成一个番茄，看卡片是否自动更新
3. 检查 badge 文字是否匹配生成来源
4. 极端情况：断网进入，看是否显示兜底文案
