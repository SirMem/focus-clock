/**
 * ai/prompts/correlation.js — 关联分析 Prompt 构建
 *
 * P1 实现。输入 30 天上下文数据，输出情绪-专注关联分析的 prompt messages。
 */

// ── 本地默认模板 ──

const DEFAULT_TEMPLATE = {
  systemPrompt: `你是一个专业的数据分析师，兼任专注力教练。
你的任务是根据用户近 30 天的专注数据和情绪标签，分析情绪与专注力之间的关联。

## 输出格式
你必须返回严格的 JSON，不要有任何额外的 markdown 标记或解释文字：
{
  "correlations": [
    {
      "emotion": "焦虑",
      "avgFocusMinutes": 45,
      "overallAvg": 75,
      "diff": "-40%",
      "interpretation": "标记'焦虑'的日子专注时长明显下降，可能与注意力分散有关"
    }
  ],
  "insight": "一句话总结情绪与专注的关系",
  "disclaimer": "基于近30天数据的统计分析，不构成心理学结论"
}

## 注意事项
- 只分析样本量 >= 2 天的情绪标签
- diff 计算方式: (avgFocusMinutes - overallAvg) / overallAvg * 100
- interpretation 要结合常识，不要过度推断
- 数据不足时说"样本不足，暂无法分析"，不要编造`,

  userPromptTemplate: `## 近 30 天专注与情绪数据

### 全局统计
总天数: 30
活跃天数: {{activeDays}}
日均专注: {{avgFocusMinutes}} 分钟
日均番茄: {{avgPomodoros}} 个

### 按情绪分组统计
{{emotionBreakdown}}

### 每日数据（部分采样）
{{dailySample}}

请根据以上数据生成关联分析 JSON。
{{#if missingDiaries}}注意：近 30 天无日记数据，无法进行情绪关联分析。{{/if}}`,
};

// ── 公开 API ────────────────────────────────────────────────

/**
 * 构建关联分析 prompt messages
 *
 * @param {import('../context/correlation-context').CorrelationContext} ctx
 * @param {{systemPrompt: string, userPromptTemplate: string}} [template]
 * @returns {Array<{role: string, content: string}>}
 */
function buildCorrelationPrompt(ctx, template) {
  const tpl = template || DEFAULT_TEMPLATE;

  const vars = {
    activeDays: ctx.overall.activeDays,
    avgFocusMinutes: ctx.overall.avgFocusMinutes,
    avgPomodoros: ctx.overall.avgPomodoros,
    emotionBreakdown: _renderEmotionBreakdown(ctx.emotionBreakdown),
    dailySample: _renderDailySample(ctx.days),
    missingDiaries: ctx._missing.includes('diaries'),
  };

  const systemContent = tpl.systemPrompt;
  const userContent = _renderTemplate(tpl.userPromptTemplate, vars);

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ];
}

// ── 渲染辅助 ────────────────────────────────────────────────

function _renderEmotionBreakdown(breakdown) {
  if (!breakdown || breakdown.length === 0) return '暂无情绪数据';
  return breakdown
    .map(e => `- ${e.emotion}: ${e.days}天, 日均${e.avgFocusMinutes}分钟, 日均${e.avgPomodoros}个番茄`)
    .join('\n');
}

function _renderDailySample(days) {
  if (!days || days.length === 0) return '暂无数据';
  // 最多采样 15 天
  const sample = days.filter(d => d.hasDiary).slice(0, 15);
  if (sample.length === 0) return '无有日记的天数';
  return sample
    .map(d => `- ${d.date}: ${d.focusMinutes}分钟 [${d.emotionTags.join(', ')}]`)
    .join('\n');
}

function _renderTemplate(templateStr, vars) {
  let result = templateStr;

  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });

  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });

  return result;
}

module.exports = { buildCorrelationPrompt, DEFAULT_TEMPLATE };
