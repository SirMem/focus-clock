/**
 * ai/prompts/weekly-report.js — 周报 Prompt 构建
 *
 * 输入: 上下文数据 + Prompt 模板
 * 输出: OpenAI-compatible messages 数组 [{role, content}]
 *
 * system prompt 和 user prompt 模板由调用方注入（来自 DB 或本地 fallback），
 * 此文件只负责数据填充和 messages 组装。
 */

// ── 本地默认模板（DB 读取失败时的 fallback）──

const DEFAULT_TEMPLATE = {
  systemPrompt: `你是一个专业且有温度的专注力教练，名叫「FocusMate」。
你的用户是中国人，正在使用番茄工作法提升专注力。

## 你的能力
- 解读专注数据，发现隐藏的模式和趋势
- 结合用户的日记和情绪标签，做关联分析
- 给出具体、可执行的改进建议（不超过 2 条）
- 用温暖鼓励的语气，像朋友一样说话
- 诚实：数据缺失时直说，不编造

## 你的限制
- 不给出医疗或心理健康诊断
- 不过度解读单一数据点
- 建议必须是用户明天就能做的事

## 输出格式
你必须返回严格的 JSON，不要有任何额外的 markdown 标记或解释文字：
{
  "report": "完整的周报文案（200-400字，用亲切的口吻）",
  "highlights": [
    { "emoji": "🔥", "text": "亮点1（简洁，10字以内）" },
    { "emoji": "📈", "text": "亮点2（简洁，10字以内）" }
  ],
  "suggestion": "最核心的一条改进建议（30字以内）",
  "emotionInsight": "情绪与专注的关联发现，如无日记数据则为 null"
}`,

  userPromptTemplate: `## 用户数据（{{weekStart}} ~ {{weekEnd}}）

### 基本信息
用户: {{userName}}
本周目标: 每天 {{dailyGoal}} 个番茄

### 专注数据
总时长: {{totalFocusMinutes}} 分钟
番茄数: {{totalPomodoros}} 个
活跃: {{activeDays}}/7 天
日均: {{avgDailyFocus}} 分钟

### 每日明细
{{dailyBreakdown}}

### 日记与情绪
{{diaries}}

### 任务完成
完成 {{taskDone}}/{{taskTotal}} ({{taskRate}})

### 时段分布
{{sessions}}

请根据以上数据生成周报。
{{#if missingDiaries}}注意：本周无日记数据，跳过情绪关联分析。{{/if}}
{{#if missingSessions}}注意：本周无时段数据，跳过时段偏好分析。{{/if}}`,
};

// ── 公开 API ────────────────────────────────────────────────

/**
 * 构建周报 prompt messages
 *
 * @param {import('../context/weekly-context').WeeklyContext} ctx
 * @param {{systemPrompt: string, userPromptTemplate: string}} [template]
 *        - 来自 ai_prompts DB 或本地默认值
 * @returns {Array<{role: string, content: string}>}
 */
function buildWeeklyReportPrompt(ctx, template) {
  const tpl = template || DEFAULT_TEMPLATE;

  // ── 渲染模板变量 ──
  const vars = {
    weekStart: ctx.weekRange.start,
    weekEnd: ctx.weekRange.end,
    userName: ctx.userName,
    dailyGoal: ctx.dailyGoal,
    totalFocusMinutes: ctx.totalFocusMinutes,
    totalPomodoros: ctx.totalPomodoros,
    activeDays: ctx.activeDays,
    avgDailyFocus: ctx.avgDailyFocus,
    dailyBreakdown: _renderDailyBreakdown(ctx.dailyBreakdown),
    diaries: _renderDiaries(ctx.diaries),
    taskDone: ctx.taskCompletion.done,
    taskTotal: ctx.taskCompletion.total,
    taskRate: ctx.taskCompletion.rate,
    sessions: _renderSessions(ctx.sessions),
    missingDiaries: ctx._missing.includes('diaries'),
    missingSessions: ctx._missing.includes('sessions'),
  };

  const systemContent = _renderTemplate(tpl.systemPrompt, vars);
  const userContent = _renderTemplate(tpl.userPromptTemplate, vars);

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

// ── 渲染辅助 ────────────────────────────────────────────────

function _renderDailyBreakdown(dailyBreakdown) {
  if (!dailyBreakdown || dailyBreakdown.length === 0) return '（暂无数据）';
  return dailyBreakdown
    .map(d => `- ${d.date}: ${d.focusMinutes}分钟 (${d.pomodoroCount}🍅)`)
    .join('\n');
}

function _renderDiaries(diaries) {
  if (!diaries || diaries.length === 0) return '本周暂无日记记录';
  return diaries
    .map(d => {
      const tags = d.emotionTags.length > 0 ? `[${d.emotionTags.join(', ')}]` : '';
      return `- ${d.date} ${tags}: ${d.content}`;
    })
    .join('\n');
}

function _renderSessions(sessions) {
  if (!sessions || sessions.length === 0) return '暂无时段数据';
  // 只取前 50 条，避免 prompt 过长
  return sessions.slice(0, 50)
    .map(s => `- ${s.date} ${s.hour}点: ${s.mode} ${s.duration}秒`)
    .join('\n');
}

/**
 * 简单的模板渲染：替换 {{key}} 占位符，处理 {{#if key}}...{{/if}}
 */
function _renderTemplate(templateStr, vars) {
  let result = templateStr;

  // ── 处理 {{#if key}}...{{/if}} ──
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });

  // ── 替换 {{key}} ──
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });

  return result;
}

module.exports = { buildWeeklyReportPrompt, DEFAULT_TEMPLATE };
