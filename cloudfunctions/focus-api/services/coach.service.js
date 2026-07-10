/**
 * coach.service.js —— AI 教练引擎
 *
 * 提供两套教练能力：
 *   规则引擎（P0 已上线）：评分、等级、洞察、建议
 *   AI 增强（🆕）：DeepSeek LLM 自然语言周报、情绪-专注关联分析
 *
 * AI 调用失败时自动降级到规则引擎，确保服务永远可用。
 *
 * 契约: docs/api-contracts.md §7
 */

const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const UserRepo = require('../repositories/user.repo');
const { getDateStr, getWeekStart } = require('../utils/helpers');
const { COACH } = require('../config/constants');

// ── 评分维度纯函数（P3-3: 阈值来自 config/constants.js） ──────────

/**
 * 持续性 (Consistency) — 权重 40%
 * 近 7 天活跃天数越多越高
 */
function calcConsistency(weekData) {
  const activeDays = weekData.filter(d => d.focusMinutes > 0).length;
  if (activeDays >= COACH.CONSISTENCY.HIGH) return COACH.SCORE.MAX;        // 100
  if (activeDays >= COACH.CONSISTENCY.MID) return COACH.SCORE.EXPERT - 1;   // 70
  if (activeDays >= COACH.CONSISTENCY.LOW) return COACH.SCORE.ADVANCED - 1; // 40
  return COACH.SCORE.MIN;                                                    // 0
}

/**
 * 专注量 (Volume) — 权重 35%
 * 近 7 天总番茄数越多越高
 */
function calcVolume(weekData) {
  const total = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
  if (total >= COACH.VOLUME.HIGH) return COACH.SCORE.MAX;        // 100
  if (total >= COACH.VOLUME.MID) return COACH.SCORE.EXPERT - 1;   // 70
  if (total >= COACH.VOLUME.LOW) return COACH.SCORE.ADVANCED - 1; // 40
  if (total >= COACH.VOLUME.MIN) return COACH.SCORE.BEGINNER - 1;  // 20
  return COACH.SCORE.MIN;                                          // 0
}

/**
 * 均衡度 (Balance) — 权重 25%
 * 每天 >= 2 个番茄的天数 vs 总活跃天数
 */
function calcBalance(weekData) {
  const highDays = weekData.filter(d => d.pomodoroCount >= 2).length;
  const totalActive = weekData.filter(d => d.focusMinutes > 0).length;
  if (totalActive === 0) return COACH.SCORE.FALLBACK;  // 30
  const ratio = highDays / totalActive;
  if (ratio >= COACH.BALANCE.HIGH_RATIO) return COACH.SCORE.MAX;  // 100
  if (ratio >= COACH.BALANCE.MID_RATIO) return COACH.SCORE.EXPERT - 1; // 60
  return COACH.SCORE.FALLBACK;  // 30
}

/**
 * 分数 → 等级映射（P3-3: 阈值来自 config/constants.js）
 */
function scoreToLevel(score) {
  if (score >= COACH.SCORE.MASTER) return COACH.LEVELS.MASTER;
  if (score >= COACH.SCORE.EXPERT) return COACH.LEVELS.EXPERT;
  if (score >= COACH.SCORE.ADVANCED) return COACH.LEVELS.ADVANCED;
  if (score >= COACH.SCORE.BEGINNER) return COACH.LEVELS.BEGINNER;
  return COACH.LEVELS.NOVICE;
}

/**
 * 洞察生成 — 基于各维度得分生成 achievement 或 improvement
 */
function generateInsights(score, weekData) {
  const insights = [];
  const consistency = calcConsistency(weekData);
  const volume = calcVolume(weekData);
  const balance = calcBalance(weekData);
  const totalPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
  const activeDays = weekData.filter(d => d.focusMinutes > 0).length;

  // 持续性洞察
  if (consistency >= 100) {
    insights.push({
      type: 'achievement',
      icon: '🔥',
      text: '连续专注表现优秀，本周 5 天以上都完成了专注！',
    });
  } else if (consistency === 0) {
    insights.push({
      type: 'improvement',
      icon: '📅',
      text: '本周还没有开始专注，现在就是最好的开始时间！',
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '📅',
      text: `本周仅 ${activeDays} 天有专注记录，尝试每周至少 5 天打开专注，好习惯从现在开始。`,
    });
  }

  // 专注量洞察
  if (volume >= 100) {
    insights.push({
      type: 'achievement',
      icon: '🍅',
      text: `本周完成 ${totalPomodoros} 个番茄，产量拉满！`,
      value: `${totalPomodoros} 个`,
    });
  } else if (volume > 0) {
    insights.push({
      type: 'improvement',
      icon: '⏱',
      text: `本周完成 ${totalPomodoros} 个番茄，每天多完成一个，很快就能感受到复利的力量。`,
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '⏱',
      text: '设定每日番茄目标，从小目标开始建立专注节奏。',
    });
  }

  // 均衡度洞察
  if (balance >= 100) {
    insights.push({
      type: 'achievement',
      icon: '⚡',
      text: '专注分布非常均衡，每天都能保持稳定的产出节奏！',
    });
  } else if (balance >= 60) {
    insights.push({
      type: 'tip',
      icon: '💡',
      text: '专注节奏不错，试着每天至少完成 2 个番茄，让每一天都有成就感。',
    });
  } else {
    insights.push({
      type: 'improvement',
      icon: '📊',
      text: '每天完成至少 2 个番茄能让专注习惯更稳固，试试看！',
    });
  }

  return insights;
}

// ── CoachService ──────────────────────────────────────────────

class CoachService {

  /**
   * @param {object} dailySummaryRepo
   * @param {object} sessionRepo
   * @param {object} userRepo
   * @param {object} [diaryRepo]      - AI 方法需要
   * @param {object} [taskRepo]       - AI 方法需要
   * @param {object} [aiClient]       - AI HTTP 客户端
   * @param {function} [promptLoader]  - Prompt 模板加载器
   */
  constructor(dailySummaryRepo, sessionRepo, userRepo, diaryRepo, taskRepo, aiClient, promptLoader) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
    this.diaryRepo = diaryRepo || require('../repositories/diary.repo').create();
    this.taskRepo = taskRepo || require('../repositories/task.repo').create();
    this.aiClient = aiClient || require('../ai/client');
    this.promptLoader = promptLoader || require('../ai_prompts').loadPromptTemplate;
  }

  /**
   * 工厂方法
   * @returns {CoachService}
   */
  static create() {
    return new CoachService(
      DailySummaryRepo.create(),
      SessionRepo.create(),
      UserRepo.create(),
    );
  }

  /**
   * 获取综合评分
   *
   * @param {string} openId
   * @returns {Promise<{score: number, level: string, insights: Array, updatedAt: number}>}
   */
  async getScore(openId) {
    const weekData = await this._getLast7DaysData(openId);
    const consistency = calcConsistency(weekData);
    const volume = calcVolume(weekData);
    const balance = calcBalance(weekData);
    const score = Math.round(
      consistency * COACH.WEIGHTS.consistency
      + volume * COACH.WEIGHTS.volume
      + balance * COACH.WEIGHTS.balance
    );
    const level = scoreToLevel(score);
    const insights = generateInsights(score, weekData);

    return { score, level, insights, updatedAt: Date.now() };
  }

  /**
   * 获取今日建议
   *
   * @param {string} openId
   * @returns {Promise<{tip: string, context: {todayPomodoros: number, weeklyAverage: number, dailyGoal: number}}>}
   */
  async getTip(openId) {
    const user = await this.userRepo.findByOpenId(openId);
    const dailyGoal = user?.settings?.dailyGoal || 4;
    const weekData = await this._getLast7DaysData(openId);
    const todayStr = getDateStr();
    const todayData = weekData.find(d => d.date === todayStr) || { pomodoroCount: 0 };
    const weeklyPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
    const weeklyAverage = Math.round(weeklyPomodoros / 7);

    let tip;
    if (todayData.pomodoroCount === 0) {
      tip = '今天还没有开始专注，打开计时器开始第一个番茄吧！';
    } else if (todayData.pomodoroCount >= dailyGoal) {
      tip = `太棒了！已完成今日目标 ${dailyGoal} 个番茄！`;
    } else if (todayData.pomodoroCount >= weeklyAverage) {
      tip = '今日表现良好，继续保持这个节奏！';
    } else {
      tip = '今日进度略慢于平均水平，利用碎片时间再冲刺一个番茄吧。';
    }

    return {
      tip,
      context: {
        todayPomodoros: todayData.pomodoroCount,
        weeklyAverage,
        dailyGoal,
      },
    };
  }

  /**
   * 获取最近 7 天的日汇总数据
   *
   * P2-2: 一次范围查询替代 7 次逐日查询。
   *
   * @param {string} openId
   * @returns {Promise<Array<{date: string, focusMinutes: number, pomodoroCount: number}>>}
   * @private
   */
  async _getLast7DaysData(openId) {
    const weekStart = getWeekStart();
    // 计算周日日期
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = getDateStr(weekEndDate);

    // P2-2: 一次查询获取 7 天数据
    const records = await this.dailySummaryRepo.findByDateRange(openId, weekStart, weekEnd);

    // 构建 date → record 映射表
    const dateMap = {};
    for (const r of records) {
      dateMap[r.date] = r;
    }

    const results = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      const dateStr = getDateStr(date);
      const record = dateMap[dateStr];

      results.push({
        date: dateStr,
        focusMinutes: record ? (record.focusMinutes || 0) : 0,
        pomodoroCount: record ? (record.pomodoroCount || 0) : 0,
      });
    }

    return results;
  }

  // ════════════════════════════════════════════════════════════
  //  🆕 AI 增强方法
  // ════════════════════════════════════════════════════════════

  /**
   * AI 周报 — 基于本周数据生成个性化自然语言报告
   *
   * 收集 5 类数据 → 读取 prompt 模板 → 调用 DeepSeek → 解析 JSON
   * 任何环节失败 → 降级到规则引擎基础文案
   *
   * @param {string} openId
   * @returns {Promise<import('../../docs/api-contracts.md').WeeklyReportResponse>}
   */
  async getWeeklyReport(openId) {
    try {
      // ① 收集上下文
      const { collectWeeklyContext } = require('../ai/context/weekly-context');
      const ctx = await collectWeeklyContext(openId, {
        dailySummaryRepo: this.dailySummaryRepo,
        sessionRepo: this.sessionRepo,
        diaryRepo: this.diaryRepo,
        taskRepo: this.taskRepo,
        userRepo: this.userRepo,
      });

      // ② 读取 prompt 模板
      const template = await this.promptLoader('weekly_report');

      // ③ 构建 messages
      const { buildWeeklyReportPrompt } = require('../ai/prompts/weekly-report');
      const messages = buildWeeklyReportPrompt(ctx, template);

      // ④ 调用 AI
      const result = await this.aiClient.chat(messages, {
        model: template.model,
        temperature: template.temperature,
        max_tokens: template.maxTokens,
      });

      console.log('[CoachService.getWeeklyReport] AI 调用成功，tokens:', result.usage?.total_tokens);

      // ⑤ 解析 JSON 响应
      let parsed;
      try {
        // 清理可能的 markdown 代码块包裹
        const jsonStr = result.content
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.warn('[CoachService.getWeeklyReport] AI 返回非 JSON，使用原始文本:', parseErr.message);
        return {
          report: result.content.slice(0, 500),
          highlights: [],
          suggestion: '',
          emotionInsight: null,
          weekSummary: _buildWeekSummary(ctx),
          generatedBy: 'ai',
          generatedAt: Date.now(),
        };
      }

      return {
        report: parsed.report || '',
        highlights: parsed.highlights || [],
        suggestion: parsed.suggestion || '',
        emotionInsight: parsed.emotionInsight || null,
        weekSummary: _buildWeekSummary(ctx),
        generatedBy: 'ai',
        generatedAt: Date.now(),
      };
    } catch (err) {
      console.error('[CoachService.getWeeklyReport] AI 调用失败，降级到规则引擎:', err.message);
      return this._getRuleFallbackReport(openId);
    }
  }

  /**
   * AI 关联分析 — 情绪标签 vs 专注时长的相关性
   *
   * P1 实现。收集 30 天数据，按情绪分组统计后交由 AI 解读。
   *
   * @param {string} openId
   * @returns {Promise<object>}
   */
  async getCorrelation(openId) {
    try {
      // ① 收集上下文
      const { collectCorrelationContext } = require('../ai/context/correlation-context');
      const ctx = await collectCorrelationContext(openId, {
        dailySummaryRepo: this.dailySummaryRepo,
        diaryRepo: this.diaryRepo,
        taskRepo: this.taskRepo,
        userRepo: this.userRepo,
      });

      // 如果完全没有日记数据，直接返回
      if (ctx.emotionBreakdown.length === 0) {
        return {
          correlations: [],
          insight: '暂无足够的日记数据进行分析，开始记录每日心情吧！',
          disclaimer: '需要至少 2 天有情绪标签的日记才能进行关联分析',
          generatedBy: 'rule',
          generatedAt: Date.now(),
          _missing: ctx._missing,
        };
      }

      // ② 读取 prompt 模板
      const template = await this.promptLoader('correlation');

      // ③ 构建 messages
      const { buildCorrelationPrompt } = require('../ai/prompts/correlation');
      const messages = buildCorrelationPrompt(ctx, template);

      // ④ 调用 AI
      const result = await this.aiClient.chat(messages, {
        model: template.model,
        temperature: template.temperature,
        max_tokens: template.maxTokens,
      });

      // ⑤ 解析
      let parsed;
      try {
        const jsonStr = result.content
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.warn('[CoachService.getCorrelation] AI 返回非 JSON:', parseErr.message);
        return {
          correlations: [],
          insight: result.content.slice(0, 300),
          disclaimer: '基于近30天数据的统计分析，不构成心理学结论',
          generatedBy: 'ai',
          generatedAt: Date.now(),
          _missing: ctx._missing,
        };
      }

      return {
        correlations: parsed.correlations || [],
        insight: parsed.insight || '',
        disclaimer: parsed.disclaimer || '基于近30天数据的统计分析，不构成心理学结论',
        generatedBy: 'ai',
        generatedAt: Date.now(),
        _missing: ctx._missing,
      };
    } catch (err) {
      console.error('[CoachService.getCorrelation] AI 调用失败:', err.message);
      return {
        correlations: [],
        insight: 'AI 分析暂时不可用，请稍后再试',
        disclaimer: '基于近30天数据的统计分析，不构成心理学结论',
        generatedBy: 'rule',
        generatedAt: Date.now(),
        _missing: [],
      };
    }
  }

  /**
   * AI 智能建议 — 基于本周专注数据 + LLM 生成个性化提示
   *
   * 复用 _getLast7DaysData（仅需 dailySummaryRepo），不引入 5-repo 的 collectWeeklyContext。
   * 降级链：LLM → getTip() 规则引擎 → 硬编码兜底
   *
   * @param {string} openId
   * @returns {Promise<{tip: string, generatedBy: 'ai'|'rule'|'fallback'}>}
   */
  async getSmartTip(openId) {
    try {
      // ① 获取本周数据（已有方法，一次范围查询）
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

      console.log('[CoachService.getSmartTip] AI 调用成功，tokens:', result.usage?.total_tokens);

      // ④ 解析（兼容 markdown code fence）
      let content = result.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('LLM 返回无 JSON');
      const parsed = JSON.parse(jsonMatch[0]);

      return { tip: parsed.tip || '继续保持专注的节奏！', generatedBy: 'ai' };
    } catch (err) {
      console.warn('[CoachService.getSmartTip] LLM 失败，降级规则引擎:', err.message);
      return this._fallbackSmartTip(openId);
    }
  }

  /**
   * 降级：规则引擎 → 硬编码
   * @param {string} openId
   * @returns {Promise<{tip: string, generatedBy: 'rule'|'fallback'}>}
   * @private
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

  /**
   * 规则引擎降级周报
   * AI 调用失败时，用现有评分逻辑拼一段基础文案
   * @param {string} openId
   * @returns {Promise<object>}
   * @private
   */
  async _getRuleFallbackReport(openId) {
    const weekData = await this._getLast7DaysData(openId);
    const totalMinutes = weekData.reduce((s, d) => s + d.focusMinutes, 0);
    const totalPomodoros = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
    const activeDays = weekData.filter(d => d.focusMinutes > 0).length;

    let report;
    if (totalMinutes === 0) {
      report = '本周还没有专注记录。打开计时器，完成你的第一个番茄，AI 教练就能为你生成个性化周报啦！';
    } else if (activeDays >= 5) {
      report = `本周你一共专注了 ${totalMinutes} 分钟，完成了 ${totalPomodoros} 个番茄，活跃了 ${activeDays} 天。太棒了，保持这个节奏！`;
    } else {
      report = `本周你专注了 ${totalMinutes} 分钟，完成了 ${totalPomodoros} 个番茄，活跃了 ${activeDays} 天。试试每周至少 5 天打开专注，习惯的力量超乎想象。`;
    }

    return {
      report,
      highlights: [],
      suggestion: activeDays < 5 ? '尝试接下来一周每天至少完成 2 个番茄，建立稳定的专注节奏。' : '继续保持！AI 周报生成暂时不可用，规则引擎为你提供了基础总结。',
      emotionInsight: null,
      weekSummary: {
        totalFocusMinutes: totalMinutes,
        totalPomodoros,
        activeDays,
        avgDailyFocus: Math.round(totalMinutes / 7),
      },
      generatedBy: 'rule',
      generatedAt: Date.now(),
    };
  }

}

module.exports = CoachService;

// ── 工具函数 ────────────────────────────────────────────────

/**
 * 从 context 提取 weekSummary
 * @private
 */
function _buildWeekSummary(ctx) {
  return {
    totalFocusMinutes: ctx.totalFocusMinutes,
    totalPomodoros: ctx.totalPomodoros,
    activeDays: ctx.activeDays,
    avgDailyFocus: ctx.avgDailyFocus,
  };
}
