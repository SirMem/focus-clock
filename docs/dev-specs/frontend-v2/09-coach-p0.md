# 09-coach-p0 — AI 教练模块 P0 实现

> 状态: 🚧 需实现  
> 契约来源: [`../../api-contracts.md`](../../api-contracts.md) §7  
> 设计参考: [`../../archive/issues/06-coach-module.md`](../../archive/issues/06-coach-module.md)
> 目标: 基于纯规则引擎实现评分和建议，不依赖外部 LLM

---

## 1. 依赖

必须在以下完成后执行：

- Stats 模块后端正运行（daily_summaries 已有数据）
- Session 模块后端正运行
- `docs/api-contracts.md` §7 契约已冻结

---

## 2. 允许修改文件

| 层 | 文件 | 操作 |
|---|---|---|
| 后端 | `cloudfunctions/focus-api/services/coach.service.js` | **新建** |
| 后端 | `cloudfunctions/focus-api/routes/coach.routes.js` | 从空桩改为完整实现 |
| 前端 | `miniprogram/api/coach.api.js` | **新建** |
| 前端 | `pages/coach/coach.js` | 接入真实 API，替换 mock |

不要修改 `cloudfunctions/focus-api/index.js`（路由已在 main 注册 coachRoutes）。

---

## 3. 当前状态

| 文件 | 状态 |
|---|---|
| `coach.routes.js` | 空桩，仅 `module.exports = (_app) => {}` |
| `coach.service.js` | 不存在 |
| `coach.api.js` | 不存在 |
| `coach.js` | 100% hardcoded mock：`WEEKLY_TREND`、`ACHIEVEMENTS`、`COACHING_HISTORY` |

底层 repo 已全部就绪：

- `DailySummaryRepo` → `findByDate()`
- `SessionRepo` → `getTodaySessions()`, `findByDateRange()`
- `DiaryRepo` → `findAll()`
- `UserRepo` → `findByOpenId()`

---

## 4. 后端实现

### 4.1 `cloudfunctions/focus-api/services/coach.service.js`（新建）

参考 `docs/archive/issues/06-coach-module.md` 的评分公式。

#### 方法：`getScore(openId)`

```js
class CoachService {
  constructor(dailySummaryRepo, sessionRepo, userRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
  }

  static create() {
    const DailySummaryRepo = require('../repositories/daily-summary.repo');
    const SessionRepo = require('../repositories/session.repo');
    const UserRepo = require('../repositories/user.repo');
    return new CoachService(
      DailySummaryRepo.create(),
      SessionRepo.create(),
      UserRepo.create()
    );
  }

  async getScore(openId) {
    const weekData = await this._getLast7DaysData(openId);
    const consistency = calcConsistency(weekData);  // 40%
    const volume = calcVolume(weekData);             // 35%
    const balance = calcBalance(weekData);           // 25%
    const score = Math.round(consistency * 0.4 + volume * 0.35 + balance * 0.25);
    const level = scoreToLevel(score);
    const insights = generateInsights(score, weekData);

    return { score, level, insights, updatedAt: Date.now() };
  }

  async getTip(openId) {
    const user = await this.userRepo.findByOpenId(openId);
    const dailyGoal = user?.settings?.dailyGoal || 4;
    const weekData = await this._getLast7DaysData(openId);
    const todayData = weekData.find(d => d.date === getDateStr()) || { pomodoroCount: 0 };
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

    return { tip, context: { todayPomodoros: todayData.pomodoroCount, weeklyAverage, dailyGoal } };
  }
}
```

#### 评分维度函数

```js
function calcConsistency(weekData) {
  const activeDays = weekData.filter(d => d.focusMinutes > 0).length;
  if (activeDays >= 5) return 100;
  if (activeDays >= 3) return 70;
  if (activeDays >= 1) return 40;
  return 0;
}

function calcVolume(weekData) {
  const total = weekData.reduce((s, d) => s + d.pomodoroCount, 0);
  if (total >= 20) return 100;
  if (total >= 10) return 70;
  if (total >= 5) return 40;
  if (total >= 1) return 20;
  return 0;
}

function calcBalance(weekData) {
  const activeDays = weekData.filter(d => d.pomodoroCount >= 2).length;
  const totalActive = weekData.filter(d => d.focusMinutes > 0).length;
  if (totalActive === 0) return 30;
  return activeDays / totalActive >= 0.6 ? 100 : activeDays / totalActive >= 0.3 ? 60 : 30;
}

function scoreToLevel(score) {
  if (score >= 81) return '大师';
  if (score >= 61) return '达人';
  if (score >= 41) return '进阶';
  if (score >= 21) return '入门';
  return '新手';
}

function generateInsights(score, weekData) {
  const insights = [];
  // 基于因子动态生成；如果 factor 满分则发 achievement，否则发 improvement
  const consistency = calcConsistency(weekData);
  const volume = calcVolume(weekData);
  const balance = calcBalance(weekData);

  if (consistency >= 100) {
    insights.push({ type: 'achievement', icon: '🔥', text: '连续专注表现优秀，本周 5+ 天都完成了专注！' });
  } else {
    insights.push({ type: 'improvement', icon: '📅', text: '尝试每周至少 5 天打开专注，好习惯从现在开始。' });
  }

  if (volume >= 100) {
    insights.push({ type: 'achievement', icon: '🍅', text: `本周完成 ${weekData.reduce((s,d)=>s+d.pomodoroCount,0)} 个番茄，产量拉满！` });
  } else {
    insights.push({ type: 'improvement', icon: '⏱', text: '每天多完成一个番茄，很快就能感受到复利的力量。' });
  }

  return insights;
}
```

### 4.2 `cloudfunctions/focus-api/routes/coach.routes.js`（改写）

```js
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

---

## 5. 前端实现

### 5.1 `miniprogram/api/coach.api.js`（新建）

```js
const { callAPI } = require('./request');

const coachAPI = {
  score() {
    return callAPI('coach/score');
  },
  tip() {
    return callAPI('coach/tip');
  },
};

module.exports = coachAPI;
```

### 5.2 `pages/coach/coach.js` 改造

`data` 新增加载标志和 API 数据槽位，删除硬编码常量。

`onLoad` 并行调用：

```js
const coachAPI = require('../../miniprogram/api/coach.api');
const statsAPI = require('../../miniprogram/api/stats.api');

async onLoad() {
  // ... statusBar setup ...

  try {
    const [scoreRes, tipRes, weeklyRes] = await Promise.all([
      coachAPI.score(),
      coachAPI.tip(),
      statsAPI.weekly(),
    ]);

    const score = scoreRes.code === 0 ? scoreRes.data : null;
    const tip = tipRes.code === 0 ? tipRes.data : null;
    const weekly = weeklyRes.code === 0 ? weeklyRes.data : null;

    this.setData({
      score,
      tip,
      weeklyTrend: weekly ? buildWeeklyTrend(weekly.dailyBreakdown) : [],
      weeklyStats: weekly ? buildWeeklyStats(weekly) : [],
      loading: false,
    });
  } catch (err) {
    wx.showToast({ title: '加载教练数据失败', icon: 'none' });
    this.setData({ loading: false });
  }
}
```

P0 不做历史建议列表和成就徽章（这些留 P1）。

---

## 6. 验收检查

- [ ] `coach/score` 返回 `{ score, level, insights }`。
- [ ] `coach/tip` 返回 `{ tip, context }`。
- [ ] Coach 页 no longer renders hardcoded mock score/suggestions。
- [ ] Coach 页周度柱状图基于 `stats/weekly` 真实数据。
- [ ] 无数据时分数为 0、建议为鼓励型文案，不报错。
- [ ] `cloudfunctions/focus-api/index.js` 无需修改（coachRoutes 已注册）。
