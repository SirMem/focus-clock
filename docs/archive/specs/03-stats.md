# Dev Spec: Stats 统计模块后端

## 文件清单

创建以下 2 个文件，修改 1 个文件：

| 操作 | 文件路径 |
|------|---------|
| 创建 | `cloudfunctions/focus-api/services/stats.service.js` |
| 修改 | `cloudfunctions/focus-api/routes/stats.routes.js`（替换全部内容） |

注意：`repositories/daily-summary.repo.js` 已经在 main 上存在，直接 require 使用。

## 1. `services/stats.service.js`

### 依赖关系

```
StatsService
  → DailySummaryRepo (已存在: repositories/daily-summary.repo.js)
  → SessionRepo (已存在: repositories/session.repo.js)
```

### 骨架

```javascript
const DailySummaryRepo = require('../repositories/daily-summary.repo');
const SessionRepo = require('../repositories/session.repo');
const { getDateStr, getWeekStart, getMonthStr, getDaysInMonth } = require('../utils/helpers');

class StatsService {

  constructor(dailySummaryRepo, sessionRepo) {
    this.dailySummaryRepo = dailySummaryRepo;
    this.sessionRepo = sessionRepo;
  }

  static create() {
    return new StatsService(DailySummaryRepo.create(), SessionRepo.create());
  }

  async getTodayStats(openId) {}
  async getWeeklyStats(openId) {}
  async getMonthlyStats(openId) {}
  async getHeatmapData(openId, year, month) {}
}

module.exports = StatsService;
```

### 方法实现细节

**getTodayStats(openId)**
- 调用 `this.dailySummaryRepo.findByDate(openId, getDateStr())`
- 如果无记录，返回 `{ focusMinutes: 0, pomodoroCount: 0, completedTasks: 0 }`
- 返回记录中的 `focusMinutes`、`pomodoroCount`、`completedTasks`、`aiScore`

注意：`DailySummaryRepo` 需要添加一个 `findByDate(openId, date)` 方法：
```javascript
async findByDate(openId, date) {
  const res = await this.collection.where({ _openid: openId, date }).get();
  return res.data[0] || null;
}
```
把此方法追加到 `repositories/daily-summary.repo.js` 中。

**getWeeklyStats(openId)**
- `weekStart = getWeekStart()` → 得到周一日期 YYYY-MM-DD
- 查 `daily-summary.repo` 中 `date >= weekStart` 的所有记录
- 如果有 `findByDateRange` 方法就用，没有就遍历 7 天分别查
- 聚合: `{ totalFocusMinutes, totalPomodoros, avgDailyFocus, activeDays, dailyBreakdown }`
- `dailyBreakdown` 是 `[{ date, focusMinutes, pomodoroCount }, ...]`，7 天连续，无数据的天填 0

**getMonthlyStats(openId)**
- `monthStr = getMonthStr()` → 得到 YYYY-MM
- 查当月所有 daily-summary 记录（date LIKE `monthStr-%`）
- 聚合: `{ totalFocusMinutes, totalPomodoros, avgDailyFocus, activeDays, totalDays（当月天数）, completionRate（activeDays/totalDays） }`

**getHeatmapData(openId, year, month)**
- 参数 `year`（数字）, `month`（数字, 1-12）
- `monthPrefix = \`${year}-${String(month).padStart(2, '0')}\``
- 查当月所有 daily-summary 记录
- 返回 `[{ date: "YYYY-MM-DD", focusMinutes: number }, ...]`，整月数据
- 不需要返回 0 的天数，Heatmap 组件自己判断

## 2. `routes/stats.routes.js`（替换全部内容）

```javascript
const StatsService = require('../services/stats.service');
const { succ } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  stats/today
  // ═══════════════════════════════════════════════════

  app.router('stats/today', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getTodayStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/weekly
  // ═══════════════════════════════════════════════════

  app.router('stats/weekly', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getWeeklyStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/monthly
  // ═══════════════════════════════════════════════════

  app.router('stats/monthly', async (ctx) => {
    const service = StatsService.create();
    const result = await service.getMonthlyStats(ctx.OPENID);
    succ(ctx, result);
  });

  // ═══════════════════════════════════════════════════
  //  stats/heatmap
  // ═══════════════════════════════════════════════════

  app.router('stats/heatmap', async (ctx) => {
    const { year, month } = ctx.event;
    if (!validate(ctx, { year: V.number(2020, 2030) })) return;
    if (!validate(ctx, { month: V.number(1, 12) })) return;

    const service = StatsService.create();
    const result = await service.getHeatmapData(ctx.OPENID, year, month);
    succ(ctx, result);
  });

};
```

## 验收检查表

- [ ] 2 个文件已创建，1 个文件已修改
- [ ] `repositories/daily-summary.repo.js` 追加了 `findByDate()` 方法
- [ ] `stats.service.js` 通过构造函数接收两个 repo
- [ ] 周统计返回 7 天连续数据（缺值补 0）
- [ ] 月统计正确计算完成率
- [ ] 没有修改 `index.js` 或其他模块的文件

## 验证方法

部署到云环境后，在 DevTools Console 执行：

```javascript
// 1. 今日统计
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'stats/today' }
}).then(r => console.log('今日:', r.result));
// 期望: { code: 0, data: { focusMinutes: N, pomodoroCount: N, ... } }

// 2. 周统计
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'stats/weekly' }
}).then(r => console.log('本周:', r.result));
// 期望: { code: 0, data: { totalFocusMinutes: N, dailyBreakdown: [...] } }

// 3. 月统计
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'stats/monthly' }
}).then(r => console.log('本月:', r.result));

// 4. 热力图
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'stats/heatmap', year: 2026, month: 7 }
}).then(r => console.log('热力图:', r.result));
```
