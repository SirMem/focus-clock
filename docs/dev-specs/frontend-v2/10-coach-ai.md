# 10-coach-ai — AI Coach 后端：DeepSeek LLM 接入

> 状态: 📋 Spec 已冻结，待实现
> 依赖: `09-coach-p0.md`（规则引擎已完成并上线）
> 契约: [`../../api-contracts.md`](../../api-contracts.md) §7.3–7.5
> 目标: 在现有规则引擎之上，接入 DeepSeek LLM，提供 AI 生成的个性化周报和情绪-专注关联分析

---

## 1. 背景与动机

### 1.1 当前状态

`09-coach-p0.md` 已完成：Coach 模块拥有完整的规则引擎后端 + 前端 UI。评分、建议、洞察全部由 `if/else` 规则生成，工作正常。

### 1.2 升级目标

规则引擎能做「数据→分数」的翻译，但无法做：

- **自然语言周报**：解读数据背后的模式，用有温度的语言呈现
- **多维度关联**：把 diary 情绪标签和 focus 数据放在一起看，发现「焦虑日专注少 40%」这类洞察
- **个性化表达**：根据用户行为模式给出差异化的建议，而非固定文案模板

### 1.3 技术决策（已确认）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| LLM 供应商 | **DeepSeek** | 性价比高，中文能力强，OpenAI 兼容 |
| 调用位置 | **云函数直调** | 简单直接，少一跳延迟 |
| 调用模式 | **同步返回** | 2-8s 延迟可接受，架构最简 |
| Prompt 管理 | **云数据库 `ai_prompts`** | 热更新，不改代码即可调 prompt |
| API 兼容 | **OpenAI-compatible** `/v1/chat/completions` | 通用标准，方便切换供应商 |
| 成本 | 无限制 | DeepSeek 成本几乎不计 |
| 降级 | **AI 失败→规则引擎 fallback** | 确保服务永远可用 |

---

## 2. 数据流与调用链

### 2.1 完整调用链

```
pages/coach/coach.js
  │
  ├─ coachAPI.score()          → 规则引擎（不变）
  ├─ coachAPI.tip()            → 规则引擎（不变）
  ├─ coachAPI.weeklyReport()   → 🆕 AI 周报
  └─ coachAPI.correlation()    → 🆕 AI 关联分析

──────────────────────────────────────────────────
  AI 调用链（以 weeklyReport 为例）
──────────────────────────────────────────────────

coachAPI.weeklyReport()
  └─ callAPI('coach/weekly-report')
      └─ coach.routes.js: coach/weekly-report
          └─ auth 中间件 → 注入 ctx.OPENID
          └─ CoachService.getWeeklyReport(ctx.OPENID)
              │
              ├─ ① 收集上下文（并行，Promise.allSettled）
              │   ├─ DailySummaryRepo.findByDate × 7    # 近 7 天日汇总
              │   ├─ SessionRepo.findByDateRange × 7      # 近 7 天 session 列表
              │   ├─ DiaryRepo.findAll × 7                # 近 7 天日记
              │   ├─ TaskRepo.count(isDone)               # 任务完成率
              │   └─ UserRepo.findByOpenId                # 用户设置/目标
              │   任一失败 → 对应字段标记为 null，不阻塞整体
              │
              ├─ ② 读取 Prompt 模板
              │   └─ ai_prompts/index.js
              │       ├─ DB: ai_prompts 集合（优先）
              │       └─ fallback: ai/prompts/ 本地默认模板
              │
              ├─ ③ 构建 messages
              │   └─ ai/prompts/weekly-report.js
              │       输入: 上下文数据 + prompt 模板
              │       输出: [{ role: "system", content: ... }, { role: "user", content: ... }]
              │
              ├─ ④ 调用 LLM
              │   └─ ai/client.js
              │       └─ POST https://api.deepseek.com/v1/chat/completions
              │           返回: { content: "...", usage: {...} }
              │
              ├─ ⑤ 解析响应
              │   └─ JSON.parse(response.content)
              │       成功 → { report, highlights, suggestion, emotionInsight, ... }
              │       失败 → 降级到规则引擎生成的基础文案
              │
              └─ ⑥ 返回给前端
```

### 2.2 降级链

```
每一层都有 fallback，确保「AI 挂了，Coach 页面不挂」：

AI Client 调用失败（超时/网络/API 错误）
  └─→ 规则引擎降级: 返回基础评分 + 文案，标记 generatedBy: "rule"

Prompt DB 读取失败
  └─→ 本地默认 prompt: ai/prompts/weekly-report.js 内置模板

部分数据源失败
  └─→ 对应字段填 null，prompt 中诚实标注"暂无数据"

JSON parse 失败（AI 返回了非 JSON）
  └─→ 包装原始文本: { rawText: "...", fallback: true }
```

---

## 3. 新增目录与文件

### 3.1 目录总览

```
cloudfunctions/focus-api/
│
├── ai/                                 # 🆕 AI 调用层
│   ├── config.js                       #   模型/API 配置
│   ├── client.js                       #   OpenAI-compatible HTTP 客户端
│   ├── prompts/
│   │   ├── weekly-report.js            #   周报 prompt 构建
│   │   └── correlation.js              #   关联分析 prompt 构建
│   └── context/
│       ├── weekly-context.js           #   周报数据收集器
│       └── correlation-context.js      #   关联分析数据收集器
│
├── ai_prompts/
│   └── index.js                        #   Prompt 模板管理（DB + fallback）
│
├── services/
│   └── coach.service.js                # 🔧 扩展: +getWeeklyReport() +getCorrelation()
│
├── routes/
│   └── coach.routes.js                 # 🔧 扩展: +coach/weekly-report +coach/correlation
│
└── config/
    └── index.js                        # 不变
```

### 3.2 文件职责

#### `ai/config.js` — AI 配置中心

单一职责：所有 AI 调用的可配置参数集中于此。

**输入**: 无
**输出**:

```js
{
  host: 'https://api.deepseek.com',     // 可替换为任意 OpenAI 兼容服务
  apiKey: string,                        // 从环境变量 DEEPSEEK_API_KEY 读取
  defaults: {
    model: 'deepseek-chat',
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 0.9,
  },
  timeout: 15000,                        // 毫秒
  retry: 1,                              // 失败重试次数
}
```

**说明**：
- `host` / `apiKey` / `model` 均可覆盖，方便切换供应商
- `apiKey` 从 `process.env.DEEPSEEK_API_KEY` 读取，不在代码中硬编码
- 部署时在微信云开发控制台 → 云函数 → 环境变量 中设置

#### `ai/client.js` — HTTP 客户端

单一职责：封装 OpenAI-compatible Chat Completions API 调用。

**输入**:
```ts
chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>

interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  timeout?: number;
}
```

**输出**:
```ts
interface ChatResult {
  content: string;          // AI 返回的文本内容
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}
```

**错误分类**:
- `AITimeoutError` — 超时
- `AINetworkError` — 网络不通
- `AIAPIError` — API 返回非 200（含 statusCode + body）
- 以上全部可被上层 catch 后走降级

**实现要点**:
- 使用 `fetch` (Node 18+ 内置)
- 请求头: `Authorization: Bearer {apiKey}`, `Content-Type: application/json`
- 端点: `{host}/v1/chat/completions`
- 超时控制: `AbortController`

#### `ai/context/weekly-context.js` — 周报数据收集器

单一职责：收集构建周报 prompt 所需的全部用户数据。

**输入**: `(openId: string, deps: ContextDeps)`
**输出**:
```ts
interface WeeklyContext {
  userName: string;
  dailyGoal: number;
  weekRange: { start: string; end: string };   // YYYY-MM-DD
  dailyBreakdown: Array<{
    date: string;
    focusMinutes: number;
    pomodoroCount: number;
  }>;
  totalFocusMinutes: number;
  totalPomodoros: number;
  activeDays: number;
  avgDailyFocus: number;
  diaries: Array<{
    date: string;
    content: string;                            // 截断到 200 字
    emotionTags: string[];
  }>;
  taskCompletion: {
    done: number;
    total: number;
    rate: string;                               // "62.5%"
  };
  sessions: Array<{
    date: string;
    mode: string;
    duration: number;
    hour: number;                               // 0-23，用于分析时段偏好
  }>;
  // 标记哪些数据源缺失（用于 prompt 诚实标注）
  _missing: string[];                           // e.g. ['diaries', 'sessions']
}
```

**数据收集策略**:
- `Promise.allSettled` 并行查询，单个数据源失败不阻塞其他
- 每个数据源失败 → 对应字段填默认空值，`_missing` 中记录
- Diary 内容截断到 200 字（防止 prompt 过长）
- Session 提取 `hour`（从 `completedAt` 时间戳计算），供 AI 分析时段偏好

#### `ai/context/correlation-context.js` — 关联分析数据收集器

单一职责：收集 30 天跨维度关联分析所需数据。

**输入**: `(openId: string, deps: ContextDeps)`
**输出**:
```ts
interface CorrelationContext {
  days: Array<{
    date: string;
    focusMinutes: number;
    pomodoroCount: number;
    emotionTags: string[];              // 当天的情绪标签
    hasDiary: boolean;
    completedTasks: number;
  }>;
  overall: {
    totalDays: number;
    activeDays: number;
    avgFocusMinutes: number;
    avgPomodoros: number;
  };
  emotionBreakdown: Array<{             // 按情绪分组统计
    emotion: string;
    days: number;
    avgFocusMinutes: number;
    avgPomodoros: number;
  }>;
  _missing: string[];
}
```

#### `ai/prompts/weekly-report.js` — 周报 Prompt 构建

**输入**: `(ctx: WeeklyContext, template: PromptTemplate)`
**输出**: `Message[]` (OpenAI 格式的 messages 数组)

**System Prompt 设计**:
```
你是一个专业且有温度的专注力教练，名叫「FocusMate」。
你的用户是中国人，正在使用番茄工作法提升专注力。

## 你的能力
- 解读专注数据，发现隐藏的模式和趋势
- 结合用户的日记和情绪标签，做关联分析
- 给出具体、可执行的改进建议（不超过 2 条）
- 用温暖鼓励的语气，像朋友一样
- 诚实：数据缺失时直说，不编造

## 你的限制
- 不给出医疗或心理健康诊断
- 不过度解读单一数据点
- 建议必须是用户明天就能做的事

## 输出格式
你必须返回严格的 JSON，不要有任何额外的文字：
{
  "report": "完整的周报文案（200-400字）",
  "highlights": [
    { "emoji": "🔥", "text": "亮点1" },
    { "emoji": "📈", "text": "亮点2" }
  ],
  "suggestion": "最核心的一条改进建议",
  "emotionInsight": "情绪与专注的关联发现，如无数据则为 null"
}
```

**User Prompt 模板**:
```
## 用户数据（{{weekRange.start}} ~ {{weekRange.end}}）

### 基本信息
用户: {{userName}}
本周目标: 每天 {{dailyGoal}} 个番茄

### 专注数据
总时长: {{totalFocusMinutes}} 分钟
番茄数: {{totalPomodoros}} 个
活跃: {{activeDays}}/7 天
日均: {{avgDailyFocus}} 分钟

### 每日明细
{{#each dailyBreakdown}}
- {{date}}: {{focusMinutes}}分钟 ({{pomodoroCount}}🍅)
{{/each}}

### 日记与情绪
{{#if diaries.length}}
{{#each diaries}}
- {{date}} [{{emotionTags}}]: {{content}}
{{/each}}
{{else}}
本周暂无日记记录
{{/if}}

### 任务完成
完成 {{taskCompletion.done}}/{{taskCompletion.total}} ({{taskCompletion.rate}})

### 时段分布
{{#if sessions.length}}
{{#each sessions}}
- {{date}} {{hour}}点: {{mode}} {{duration}}秒
{{/each}}
{{else}}
暂无时段数据
{{/if}}

请根据以上数据生成周报。注意：
{{#if _missing.includes('diaries')}}- 本周无日记数据，跳过情绪关联分析{{/if}}
{{#if _missing.includes('sessions')}}- 本周无时段数据，跳过时段偏好分析{{/if}}
```

#### `ai/prompts/correlation.js` — 关联分析 Prompt 构建

**输入**: `(ctx: CorrelationContext, template: PromptTemplate)`
**输出**: `Message[]`

与 weekly-report 类似结构，但 prompt 侧重于「情绪标签 → 专注时长」的统计分析。输出格式：

```ts
{
  correlations: Array<{
    emotion: string;
    avgFocusMinutes: number;
    overallAvg: number;
    diff: string;              // "+12%" or "-40%"
    interpretation: string;    // AI 对差异的解读
  }>;
  insight: string;             // 一句话总结
  disclaimer: string;          // "基于近30天数据的统计分析，不构成心理学结论"
}
```

#### `ai_prompts/index.js` — Prompt 模板管理

单一职责：从云数据库读取 prompt 模板，读取失败时降级到本地默认值。

**输入**: `(type: 'weekly_report' | 'correlation')`
**输出**:
```ts
interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  model: string;
  temperature: number;
  maxTokens: number;
  source: 'db' | 'local';     // 标记来源
  version: number;
}
```

**DB 查询逻辑**:
```
db.collection('ai_prompts')
  .where({ type, isActive: true })
  .orderBy('version', 'desc')
  .limit(1)
  .get()
```

**DB 集合 `ai_prompts` 文档结构**:
```ts
{
  _id: string;
  type: 'weekly_report' | 'correlation';
  version: number;
  systemPrompt: string;       // system role 的 prompt 文本
  userPromptTemplate: string; // user role 的模板（支持 {{placeholder}}）
  model?: string;             // 覆盖 ai/config.js 的默认 model
  temperature?: number;       // 覆盖默认 temperature
  maxTokens?: number;         // 覆盖默认 max_tokens
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}
```

**本地默认值**:
- `ai/prompts/weekly-report.js` 和 `correlation.js` 各自 export 一个 `DEFAULT_TEMPLATE`
- 当 DB 查询失败或找不到 active 模板时使用

#### `services/coach.service.js` — 扩展

在现有 `CoachService` 类中新增两个方法：

```ts
class CoachService {
  // ── 现有方法（不变）──
  static create(): CoachService
  async getScore(openId): Promise<ScoreResult>
  async getTip(openId): Promise<TipResult>

  // ── 🆕 AI 方法 ──
  async getWeeklyReport(openId): Promise<WeeklyReportResult>
  async getCorrelation(openId): Promise<CorrelationResult>
}
```

**`getWeeklyReport(openId)` 逻辑**:
```
1. 注入 ai/context + ai/prompts + ai/client 依赖
2. 并行收集数据 → WeeklyContext
3. 读取 prompt 模板 → PromptTemplate
4. 构建 messages → buildWeeklyReportPrompt(ctx, template)
5. 调用 AI → client.chat(messages, { model, temperature, max_tokens })
6. JSON.parse(response.content)
   - 成功 → 返回 { ...parsed, generatedBy: 'ai', generatedAt: Date.now() }
   - JSON 解析失败 → 返回 { report: ruleFallbackText, generatedBy: 'rule' }
   - AI 调用失败 → catch error → 返回 { report: ruleFallbackText, generatedBy: 'rule' }
```

**`getCorrelation(openId)` 逻辑**:
```
同上，使用 correlation-context → correlation prompt → AI 调用
```

**降级文案生成**（规则引擎 fallback）:
当 AI 调用失败时，用现有 `calcConsistency/calcVolume/calcBalance` 的规则结果拼一段基础文案：
```
"本周你一共专注了 X 分钟，完成了 Y 个番茄，活跃了 Z 天。
继续保持这个节奏，下周会更好！"
```

#### `routes/coach.routes.js` — 扩展

在现有两个路由基础上新增：

```js
// 现有（不变）
app.router('coach/score', ...)
app.router('coach/tip', ...)

// 🆕
app.router('coach/weekly-report', async (ctx) => {
  const service = CoachService.create();
  const result = await service.getWeeklyReport(ctx.OPENID);
  succ(ctx, result);
});

app.router('coach/correlation', async (ctx) => {
  const service = CoachService.create();
  const result = await service.getCorrelation(ctx.OPENID);
  succ(ctx, result);
});
```

---

## 4. API 契约

> 以下契约同步更新至 `docs/api-contracts.md` §7.3–7.5

### 4.1 `coach/weekly-report` — AI 周报

**路由**: `coach/weekly-report`
**方法**: GET

#### 请求

```ts
{} // 无参数，基于本周（周一~周日）数据
```

#### 响应

```ts
// 成功（AI 生成）
{
  code: 0,
  data: {
    report: string;                    // AI 生成的完整周报（200-400字）
    highlights: Array<{
      emoji: string;                   // e.g. "🔥"
      text: string;                    // e.g. "连续5天保持专注"
    }>;
    suggestion: string;                // 最核心的一条改进建议
    emotionInsight: string | null;     // 情绪关联发现，如 "标记'焦虑'的日子专注时长减少40%"
    weekSummary: {                     // 本周基础数据
      totalFocusMinutes: number;
      totalPomodoros: number;
      activeDays: number;
      avgDailyFocus: number;
    };
    generatedBy: 'ai' | 'rule';       // 'ai' = LLM 生成, 'rule' = 降级到规则引擎
    generatedAt: number;               // unix 毫秒时间戳
  }
}

// 降级（AI 失败，规则引擎兜底）
{
  code: 0,
  data: {
    report: string;                    // 规则引擎生成的基础文案
    highlights: [];                    // 降级时为空
    suggestion: string;                // 规则引擎的基础建议
    emotionInsight: null;              // 降级时无情绪分析
    weekSummary: { ... };              // 相同
    generatedBy: 'rule';
    generatedAt: number;
  }
}
```

### 4.2 `coach/correlation` — 情绪-专注关联分析

**路由**: `coach/correlation`
**方法**: GET
**备注**: P1 实现，P0 先完成契约定义

#### 请求

```ts
{} // 基于近 30 天数据
```

#### 响应

```ts
{
  code: 0,
  data: {
    correlations: Array<{
      emotion: string;                  // 情绪标签 e.g. "焦虑"
      days: number;                     // 该情绪出现的天数
      avgFocusMinutes: number;          // 该情绪日的平均专注时长
      overallAvg: number;               // 全时段平均专注时长（对照组）
      diff: string;                     // 差异百分比 e.g. "-40%" or "+12%"
      interpretation: string;           // AI 对差异的一句话解读
    }>;
    insight: string;                    // AI 总结的一句话
    disclaimer: string;                 // 免责声明
    generatedBy: 'ai' | 'rule';
    generatedAt: number;
    _missing: string[];                 // 缺失的数据源
  }
}
```

### 4.3 `ai_prompts` 集合设计

新增数据库集合：

| 集合名 | 说明 | 索引 |
|--------|------|------|
| `ai_prompts` | AI Prompt 模板（热更新） | `type` + `isActive` |

文档结构见 §3.2 `ai_prompts/index.js` 说明。

---

## 5. 前端改动

### 5.1 `miniprogram/api/coach.api.js`

```js
const coachAPI = {
  score()         { return callAPI('coach/score'); },
  tip()           { return callAPI('coach/tip'); },
  weeklyReport()  { return callAPI('coach/weekly-report'); },  // 🆕
  correlation()   { return callAPI('coach/correlation'); },    // 🆕
};
```

### 5.2 `pages/coach/coach.js`

`_loadCoachData()` 的 `Promise.all` 中新增 `coachAPI.weeklyReport()`：

```js
const [scoreRes, tipRes, weeklyRes, reportRes] = await Promise.all([
  coachAPI.score(),
  coachAPI.tip(),
  statsAPI.weekly(),
  coachAPI.weeklyReport(),   // 🆕
]);
```

新增 data 字段:
- `aiReport: ''` — AI 周报全文
- `aiHighlights: []` — 亮点列表
- `aiSuggestion: ''` — 核心建议
- `aiEmotionInsight: ''` — 情绪关联发现
- `reportGeneratedBy: ''` — 'ai' | 'rule'

### 5.3 `pages/coach/coach.wxml`

在「趋势洞察」卡片中展示 AI 周报内容，替代当前硬编码的 `suggestionText`：
- 如果 `generatedBy === 'ai'`：展示完整 AI 报告 + AI 标记徽章
- 如果 `generatedBy === 'rule'`：展示基础文案，不显示 AI 标记

---

## 6. 验收检查

### 6.1 后端

- [ ] `ai/config.js` 存在，`host`/`apiKey`/`model`/`temperature`/`max_tokens`/`timeout` 均可配置
- [ ] `ai/client.js` 发送 OpenAI-compatible `POST /v1/chat/completions` 请求
- [ ] `ai/client.js` 正确处理超时、网络错误、API 错误
- [ ] `ai/context/weekly-context.js` 并行收集 5 类数据，单个失败不影响整体
- [ ] `ai/context/correlation-context.js` 并行收集 30 天数据
- [ ] `ai/prompts/weekly-report.js` 输出合法 JSON（能 `JSON.parse`）
- [ ] `ai_prompts/index.js` 优先 DB 读取，失败降级到本地默认
- [ ] `coach/weekly-report` 返回 `{ report, highlights, suggestion, emotionInsight, weekSummary, generatedBy, generatedAt }`
- [ ] `coach/correlation` 返回 `{ correlations, insight, disclaimer, generatedBy, generatedAt }`
- [ ] AI 超时/失败 → `generatedBy: 'rule'` + 规则引擎基础文案，**不抛 500**
- [ ] 无数据用户（新用户）→ AI 提示「开始你的第一个专注」，不抛错
- [ ] `cloudfunctions/focus-api/index.js` 无需修改（coachRoutes 已注册）

### 6.2 前端

- [ ] `coach.api.js` 新增 `weeklyReport()` + `correlation()` 方法
- [ ] Coach 页并行加载 AI 报告，不增加用户等待时间
- [ ] AI 报告区域正确渲染 `generatedBy === 'ai'` 和 `'rule'` 两种状态
- [ ] AI 报告加载失败不阻塞其他卡片（score/tip/weekly stats 正常显示）

### 6.3 运维

- [ ] 云函数环境变量 `DEEPSEEK_API_KEY` 已设置
- [ ] `ai_prompts` 集合已创建，至少有一条 `weekly_report` 模板文档
- [ ] Prompt 热更新验证：修改 DB 中的 prompt 模板 → Coach 页报告风格变化

---

## 7. 实现顺序

| # | 文件 | 操作 | 预估行数 | 依赖 |
|---|------|------|----------|------|
| 1 | `ai/config.js` | 新建 | ~20 | 无 |
| 2 | `ai/client.js` | 新建 | ~60 | `ai/config.js` |
| 3 | `ai/context/weekly-context.js` | 新建 | ~80 | 现有 repos |
| 4 | `ai/context/correlation-context.js` | 新建 | ~90 | 现有 repos |
| 5 | `ai/prompts/weekly-report.js` | 新建 | ~50 | 无 |
| 6 | `ai/prompts/correlation.js` | 新建 | ~50 | 无 |
| 7 | `ai_prompts/index.js` | 新建 | ~40 | DB |
| 8 | `coach.service.js` | 扩展 | +80 | 1-7 |
| 9 | `coach.routes.js` | 扩展 | +20 | 8 |
| 10 | `coach.api.js` | 扩展 | +2 | 无 |
| 11 | `coach.js` | 扩展 | +30 | 10 |
| 12 | `coach.wxml` | 扩展 | +20 | 11 |
| 13 | `docs/api-contracts.md` | 扩展 | +80 | 全部契约确认 |

**总计**: 新建 8 个文件，扩展 5 个文件，新增约 600 行代码。

---

## 8. 与其他模块的关系

```
                    ┌──────────────┐
                    │  coach/score │  (规则引擎，不变)
                    │  coach/tip   │
                    └──────┬───────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ DailySummary│    │   Session   │    │    User     │
│    Repo     │    │    Repo     │    │    Repo     │
└─────────────┘    └─────────────┘    └─────────────┘
                                               │
                    ┌─────────────┐            │
                    │   Diary     │            │
                    │    Repo     │            │
                    └─────────────┘            │
                                               │
                    ┌─────────────┐            │
                    │   Task      │            │
                    │    Repo     │            │
                    └─────────────┘            │
                                               │
       ┌───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│              🆕 AI Coach 扩展                      │
│                                                   │
│  coach/weekly-report  ← AI 周报                    │
│  coach/correlation    ← AI 关联分析 (P1)            │
│                                                   │
│  共用现有 5 个 Repo，只读不写                        │
│  新增 ai/ 层封装 LLM 调用                           │
└──────────────────────────────────────────────────┘
```

**关键约束**:
- AI 层**只读不写**：不从 AI 响应中提取数据回写 DB
- AI 层**不依赖**任何其他 Service，只依赖 Repo
- CoachService 是唯一的编排入口
