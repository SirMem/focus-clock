/**
 * config/constants.js —— 业务常量与魔法数字
 *
 * 所有模块共享的评分阈值、权重、极限值等常量集中管理于此。
 * 不要在此文件中引用业务模块。
 *
 * 参考: docs/known-issues.md §P3-3
 */

// ─── 时间戳 ───

/** 远大于任何合理 Unix 时间戳（约 285 百万年），用于表示「无上限」的 lte 查询 */
const FAR_FUTURE_TIMESTAMP = 9e15;

// ─── 教练评分 ───

const COACH = {
  // 持续性 (Consistency) — 权重 40%，近 7 天活跃天数阈值
  CONSISTENCY: {
    HIGH: 5,   // ≥5 天 → 100 分
    MID: 3,    // ≥3 天 → 70 分
    LOW: 1,    // ≥1 天 → 40 分
  },

  // 专注量 (Volume) — 权重 35%，近 7 天总番茄数阈值
  VOLUME: {
    HIGH: 20,  // ≥20 个 → 100 分
    MID: 10,   // ≥10 个 → 70 分
    LOW: 5,    // ≥5 个  → 40 分
    MIN: 1,    // ≥1 个  → 20 分
  },

  // 均衡度 (Balance) — 权重 25%，日均 ≥2 番茄的天数占比阈值
  BALANCE: {
    HIGH_RATIO: 0.6,  // ≥60% → 100 分
    MID_RATIO: 0.3,   // ≥30% → 60 分
  },

  // 分数 → 等级映射阈值
  SCORE: {
    MAX: 100,
    MASTER: 81,    // ≥81 → 大师
    EXPERT: 61,    // ≥61 → 达人
    ADVANCED: 41,  // ≥41 → 进阶
    BEGINNER: 21,  // ≥21 → 入门
    MIN: 0,        // <21 → 新手
    FALLBACK: 30,  // 均衡度 fallback（无活跃天数时）
  },

  // 评分维度权重（总和 = 1.0）
  WEIGHTS: {
    consistency: 0.4,
    volume: 0.35,
    balance: 0.25,
  },

  // 等级标签
  LEVELS: {
    MASTER: '大师',
    EXPERT: '达人',
    ADVANCED: '进阶',
    BEGINNER: '入门',
    NOVICE: '新手',
  },
};

module.exports = {
  FAR_FUTURE_TIMESTAMP,
  COACH,
};
