# 13-trend-chart-day-month — 专注趋势图：日视图与月视图实现

> 状态: 🚧 待实现
> 依赖: `05-stats.md`（Stats 基础数据对接已完成）
> 目标: 将统计页目前空置的"日专注趋势"和"月专注趋势"接入真实数据，日视图采用柱状图（按小时分桶），月视图采用折线面积图（同周视图）

---

## 1. 当前状态

统计页顶部有三个 period 选择器（日/周/月），共用同一个 `#trendChart` ECharts 组件。当前只有**周视图**有数据：

| period | 图表类型 | 数据状态 | 当前代码行 |
|--------|----------|----------|-----------|
| `day` | 折线面积图（初始类型） | ❌ 空图表 | `stats.js:411-412` — 空态，注释"后端暂不提供日内明细" |
| `week` | 折线面积图 | ✅ `weeklyStats.dailyBreakdown` | `stats.js:413-419` — 已有数据 |
| `month` | 折线面积图（初始类型） | ❌ 空图表 | `stats.js:421-423` — 空态，注释"后端暂不提供月内趋势明细" |

ECharts 初始化的 series type 为 `'line'`（`stats.js:29`），日视图需在 `_refreshTrendChart` 中动态切换为 `'bar'`。

### 当前 `_refreshTrendChart` 代码（`stats.js:405-435`）

```js
_refreshTrendChart(period) {
    const { weeklyStats } = this.data;
    let data = [];
    let title;

    if (period === 'day') {
      title = '今日专注趋势';
      // P0 后端暂不提供日内明细，保持空图表而不展示伪造趋势。
    } else if (period === 'week') {
      title = '本周专注趋势';
      if (weeklyStats && Array.isArray(weeklyStats.dailyBreakdown)) {
        data = weeklyStats.dailyBreakdown.map(d => ({
          label: (d.date || '').slice(-2) + '日',
          value: d.focusMinutes || 0,
        }));
      }
    } else {
      title = '本月专注趋势';
      // P0 后端暂不提供月内趋势明细，保持空图表而不展示伪造趋势。
    }

    this.setData({ trendTitle: title });

    const ecComp = this.selectComponent('#trendChart');
    if (ecComp && ecComp.chart) {
      ecComp.chart.setOption({
        xAxis: { data: data.map(d => d.label) },
        series: [{ data: data.map(d => d.value) }],
      });
    }
  },
```

---

## 2. 允许修改文件

| 层 | 文件 | 操作 |
|---|---|---|
| 后端 | `cloudfunctions/focus-api/services/stats.service.js` | `getMonthlyStats()` 新增 `dailyBreakdown` 字段；新增 `getTodayDetail()` 方法（按小时分桶） |
| 后端 | `cloudfunctions/focus-api/routes/stats.routes.js` | 新增 `stats/today/detail` 路由 |
| 前端 | `miniprogram/api/stats.api.js` | 新增 `todayDetail()` 方法 |
| 前端 | `pages/stats/stats.js` | `_refreshTrendChart()` 三个分支全部改为真实数据处理；增加日趋势数据源加载；ECharts 动态切换 type |
| 前端 | `pages/stats/stats.js` | 注释更新：删除"后端暂不提供"的 P0 标记 |

不改动：
- `daily-summary.repo.js`（不需要新方法，`findByDateRange` 已满足月视图需求）
- `session.repo.js`（不需要新方法，`getTodaySessions` 已满足日视图需求）
- `pages/stats/stats.wxml`（不变更 DOM 结构，只更新数据绑定期望在已有 binding 中）
- `pages/stats/stats.wxss`（不变更样式）

---

## 3. 数据源设计

### 3.1 月视图数据源 — `stats/monthly` 新增 `dailyBreakdown`

现有的 `getMonthlyStats()`（`stats.service.js:131-171`）已在循环中遍历整月每条 `daily_summaries`，但只做了汇总累加，没有将每日明细输出。改造方式：在循环中同时构建 `dailyBreakdown` 数组，与 `getWeeklyStats()` 的 `dailyBreakdown` 形状一致。

**改造后返回格式（`{ date, focusMinutes, pomodoroCount }` 每天一条，整月共 28~31 条）**：

```js
{
  totalFocusMinutes: 600,
  totalPomodoros: 8,
  avgDailyFocus: 19,
  activeDays: 3,
  totalDays: 31,
  completionRate: 0.1,
  // 🆕 新增：每日明细，与 weeklyStats.dailyBreakdown 形状一致
  dailyBreakdown: [
    { date: "2026-07-01", focusMinutes: 120, pomodoroCount: 4 },
    { date: "2026-07-02", focusMinutes: 0, pomodoroCount: 0 },
    { date: "2026-07-03", focusMinutes: 45, pomodoroCount: 2 },
    // ... 共 31 条，无记录的日期 focusMinutes=0, pomodoroCount=0
  ]
}
```

**设计要点**：
- 每天一条，无记录的日期填 0 而非跳过（与 weekly 一致）
- 数组总长度 = `totalDays`（本月天数）
- 结构复用 `weeklyStats.dailyBreakdown` 的模式，前端无需单独适配
- `daily_summaries` 数据库零改动，仅后端返回时多投影一个数组字段

### 3.2 日视图数据源 — 后端新增 `stats/today/detail`

**数据来源**：`session.repo.js` 已有 `getTodaySessions(openId)` 方法，查询当日所有 sessions 记录（含 `startedAt` 时间戳和 `duration` 秒数）。

**后端处理逻辑**：将今日所有 sessions 按 `startedAt` 的 hour 字段分到 24 个 bucket 中，每个 bucket 累加 `duration` 并转为分钟，返回 24 个 `{ hour, focusMinutes }` 条目。

**返回格式**：

```js
{
  hourlyBreakdown: [
    { hour: 0, focusMinutes: 0 },
    { hour: 1, focusMinutes: 0 },
    // ... 无专注的小时 focusMinutes=0
    { hour: 10, focusMinutes: 50 },
    // ...
    { hour: 23, focusMinutes: 0 },
  ]
}
```

**设计要点**：
- 固定 24 条（0~23 时），无活动的 hour 填 0
- `focusMinutes` 是秒转分钟后的结果（`Math.round(duration / 60)`）
- 只统计 `isPomodoro === true` 或 `mode === 'focus'` 的 session（排除 break 类型）
- 不建新集合、不加新字段，纯聚合计算

---

## 4. 后端实现

### 4.1 `stats.service.js` — `getMonthlyStats()` 新增 `dailyBreakdown`

在现有的 `for (let d = 1; d <= totalDays; d++)` 循环中，在累加汇总的同时 push `dailyBreakdown`：

```js
const dailyBreakdown = []; // 🆕

for (let d = 1; d <= totalDays; d++) {
  const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
  const record = dateMap[dateStr];

  // 🆕 构建每日明细（无论当天有没有记录，都 push 一条）
  dailyBreakdown.push({
    date: dateStr,
    focusMinutes: record ? (record.focusMinutes || 0) : 0,
    pomodoroCount: record ? (record.pomodoroCount || 0) : 0,
  });

  if (record) {
    totalFocusMinutes += record.focusMinutes || 0;
    totalPomodoros += record.pomodoroCount || 0;
    activeDays++;
  }
}

return {
  totalFocusMinutes,
  totalPomodoros,
  avgDailyFocus: Math.round(totalFocusMinutes / totalDays),
  activeDays,
  totalDays,
  completionRate: Math.round((activeDays / totalDays) * 100) / 100,
  dailyBreakdown, // 🆕
};
```

### 4.2 `stats.service.js` — 新增 `getTodayDetail()` 方法

```js
/**
 * 获取今日专注小时分布
 *
 * 从 sessions 集合查询今日所有 focus 类 session，
 * 按 startedAt 的小时（0-23）分桶，返回每小时专注分钟数。
 * 无记录的 hour 填 0。
 *
 * @param {string} openId
 * @returns {Promise<{hourlyBreakdown: Array<{hour: number, focusMinutes: number}>}>}
 */
async getTodayDetail(openId) {
  const sessions = await this.sessionRepo.getTodaySessions(openId);

  // 初始化 24 个 bucket，全部填 0
  const buckets = new Array(24).fill(0);

  for (const s of sessions) {
    // 只统计 focus 类 session（排除 break）
    if (s.mode !== 'focus') continue;

    const startDate = new Date(s.startedAt);
    const hour = startDate.getHours();
    const minutes = Math.round((s.duration || 0) / 60);
    buckets[hour] += minutes;
  }

  const hourlyBreakdown = buckets.map((minutes, hour) => ({
    hour,
    focusMinutes: minutes,
  }));

  return { hourlyBreakdown };
}
```

### 4.3 `stats.routes.js` — 新增 `stats/today/detail` 路由

```js
// stats/today/detail
app.router('stats/today/detail', async (ctx) => {
  const service = StatsService.create();
  const result = await service.getTodayDetail(ctx.OPENID);
  succ(ctx, result);
});
```

---

## 5. 前端实现

### 5.1 `stats.api.js` — 新增 `todayDetail()` 方法

```js
todayDetail() {
  return callAPI('stats/today/detail');
},
```

### 5.2 `pages/stats/stats.js` — 数据加载

**data 新增字段**：

```js
data: {
  // ... 现有字段不变
  todayDetail: null,  // 🆕 今日小时分布 { hourlyBreakdown }
}
```

**_loadStats() 改造**：在并行请求中增加 `todayDetail` 请求。

```js
async _loadStats() {
  this.setData({ loading: true });
  try {
    const now = new Date();
    const [todayRes, weeklyRes, monthlyRes, heatmapRes, todayDetailRes] = await Promise.all([  // 🆕 增加 todayDetailRes
      statsAPI.today(),
      statsAPI.weekly(),
      statsAPI.monthly(),
      statsAPI.heatmap(now.getFullYear(), now.getMonth() + 1),
      statsAPI.todayDetail(),  // 🆕
    ]);

    const today = extractData(todayRes, {});
    const weekly = extractData(weeklyRes, {});
    const monthly = extractData(monthlyRes, {});
    const heatmap = extractData(heatmapRes, []);
    const todayDetail = extractData(todayDetailRes, null);  // 🆕 可能为空（新用户无 session）

    this.setData({
      todayStats: today || {},
      weeklyStats: weekly || {},
      monthlyStats: monthly || {},
      heatmapData: Array.isArray(heatmap) ? heatmap : [],
      todayDetail: todayDetail || { hourlyBreakdown: new Array(24).fill(0).map((_, i) => ({ hour: i, focusMinutes: 0 })) },  // 🆕
    });

    // 404 不算失败（新用户首次进入无 session，接口返回空数据是正常场景）
    const didFail = todayRes.code !== 0 || weeklyRes.code !== 0 ||
                    monthlyRes.code !== 0 || heatmapRes.code !== 0;

    // ... 后续更新视图不变
    this._updateSummaryCards();
    this._updateTrendChart();
    this._updateRingCharts();
    this._updateHeatmap();
    this._updateScoreCard();
  }
}
```

**设计要点**：
- `todayDetail` 数据为 null 时（新用户无 session）用默认 24 个 0 补全，避免图表渲染报错
- `todayDetailRes` 请求失败（`code !== 0`）**不参与** `didFail` 判断——新用户无 session 时后端返回空数据而非错误，因此无需 toast 提示
- 并行请求 `Promise.all` 中新增一个请求，不增加串行等待时间

### 5.3 `pages/stats/stats.js` — `_refreshTrendChart` 三视图实现

```js
_refreshTrendChart(period) {
  const { weeklyStats, monthlyStats, todayDetail } = this.data;
  let data = [];
  let title = '';
  let seriesType = 'line';  // 默认折线面积图

  if (period === 'day') {
    title = '今日专注趋势';
    seriesType = 'bar';  // 🆕 日视图改用柱状图
    // 🆕 从 todayDetail.hourlyBreakdown 获取数据
    if (todayDetail && Array.isArray(todayDetail.hourlyBreakdown)) {
      data = todayDetail.hourlyBreakdown.map(d => ({
        label: d.hour + '时',
        value: d.focusMinutes || 0,
      }));
    }
  } else if (period === 'week') {
    title = '本周专注趋势';
    // 已有逻辑不变
    if (weeklyStats && Array.isArray(weeklyStats.dailyBreakdown)) {
      data = weeklyStats.dailyBreakdown.map(d => ({
        label: (d.date || '').slice(-2) + '日',
        value: d.focusMinutes || 0,
      }));
    }
  } else {
    title = '本月专注趋势';
    // 🆕 从 monthlyStats.dailyBreakdown 获取数据（原为空态）
    if (monthlyStats && Array.isArray(monthlyStats.dailyBreakdown)) {
      data = monthlyStats.dailyBreakdown.map(d => ({
        label: (d.date || '').slice(-2) + '日',
        value: d.focusMinutes || 0,
      }));
    }
  }

  this.setData({ trendTitle: title });

  const ecComp = this.selectComponent('#trendChart');
  if (ecComp && ecComp.chart) {
    ecComp.chart.setOption({
      xAxis: { data: data.map(d => d.label) },
      series: [{ type: seriesType, data: data.map(d => d.value) }],  // 🆕 动态切换 type
    });
  }
},
```

**设计要点**：
- `series.type` 从初始化时的 `line` 改为在 `setOption` 中动态指定——ECharts 的 `setOption` 会自动替换系列类型（柱状 ↔ 折线的无缝切换）
- 周/月视图的 `seriesType` 保持 `'line'`，日视图为 `'bar'`
- 柱状图不需要 `smooth`、`areaStyle`、`symbol` 等折线图专属属性——ECharts 切换 type 时会忽略无关属性，无需额外清理
- 日视图 label 后缀为 `'时'`（`0时`, `1时`, ..., `23时`）；周/月视图 label 后缀为 `'日'`（`01日`, `02日`, ...）

### 5.4 ECharts option 差异汇总

| 属性 | 日视图（bar） | 周视图（line） | 月视图（line） |
|------|--------------|----------------|----------------|
| `type` | `'bar'` | `'line'` | `'line'` |
| `smooth` | N/A（bar 无视） | `true` | `true` |
| `symbol` | N/A（bar 无视） | `'circle'` | `'circle'` |
| `areaStyle` | N/A（bar 无视） | 渐变填充 | 渐变填充 |
| `barWidth` | 建议 `12`（rpx 级，用百分比避免固定像素） | N/A | N/A |
| `itemStyle.color` | `'#4A90D9'` | `'#4A90D9'` | `'#4A90D9'` |

由于 ECharts 在替换 series type 时会忽略不支持的属性，`setOption` 只需传入 `{ type: seriesType, data: ... }` + 通用属性即可，不需要按 period 构建不同结构的 option 对象。

---

## 6. BDD 场景

### 场景 1：日视图 — 有 sessions 时展示小时分布柱状图

```
Given 用户今天完成了 3 次专注
  And 分别在 10:00、14:30、20:00 开始
  And 每次 25 分钟
When 进入统计页
  And 点击 period 选择"日"
Then 柱状图显示 24 根柱子
  And 10 时柱子高度为 25
  And 14 时柱子高度为 25
  And 20 时柱子高度为 25
  And 其余柱子高度为 0
  And 标题显示"今日专注趋势"
```

### 场景 2：日视图 — 新用户无 session 时全 0

```
Given 用户今天没有完成任何专注 session
When 进入统计页
  And 点击 period 选择"日"
Then 柱状图显示 24 根柱子，全部高度为 0
  And 不报错
  And 不显示 toast
```

### 场景 3：日视图 — 后端 API 不可用时降级

```
Given 用户已进入统计页
  And todayDetail 接口返回 code !== 0 或网络不可达
When 点击 period 选择"日"
Then 柱状图显示 24 根 0 值柱子（用默认空数据代替）
  And 不 toast
  And 不崩溃
  And 不影响周/月视图的正常展示
```

### 场景 4：周视图 — 保持不变

```
Given 用户本周有专注记录
When 进入统计页
  And 点击 period 选择"周"
Then 折线面积图展示 7 天的每日专注分钟数
  And 标题显示"本周专注趋势"
  （已有功能，回归验证）
```

### 场景 5：月视图 — 有数据时展示每日趋势折线图

```
Given 用户本月 6 月 25~29 日有专注记录
  And 6月25日 50 分钟，6月26日 100 分钟
When 进入统计页
  And 点击 period 选择"月"
Then 折线面积图展示整月每日专注分钟数
  And 6月25日对应的点值为 50
  And 6月26日对应的点值为 100
  And 6月27~29日有各自对应的真实值
  And 其余日期值为 0
  And 标题显示"本月专注趋势"
```

### 场景 6：月视图 — 新用户无数据时全 0

```
Given 用户本月没有专注记录
  And monthlyStats.dailyBreakdown 是 31 条全 0 数组
When 进入统计页
  And 点击 period 选择"月"
Then 折线面积图显示 31 个点，全部为 0
  And 不报错
```

### 场景 7：三视图切换时图表类型正确切换

```
Given 用户有今日和本月数据
When 依次点击 period 选择 "日" → "周" → "月"
Then ECharts 图表类型依次切换为 柱状图 → 折线面积图 → 折线面积图
  And 每次切换数据对应更新
  And 无渲染残留（上次的数据点不会残留在切换后的图表中）
```

### 场景 8：跨天数据一致性 — 月视图与周视图的交叉日期数据一致

```
Given 本周的第一天与本月在同一天范围内（如都是当周）
When 分别查看周视图和月视图
Then 重叠日期（如本月1~7日）在两张图中的 focusMinutes 值一致
  （验证 dailyBreakdown 的数据来源一致——都来自 daily_summaries）
```

---

## 7. 验收检查

### 后端

- [ ] `getMonthlyStats()` 返回的 `dailyBreakdown` 数组长度为 `totalDays`（28~31）
- [ ] `dailyBreakdown` 中每条包含 `{ date, focusMinutes, pomodoroCount }`
- [ ] 无记录的日期 `focusMinutes` 和 `pomodoroCount` 为 0
- [ ] `getTodayDetail()` 返回的 `hourlyBreakdown` 数组长度为 24（0~23 时）
- [ ] `hourlyBreakdown` 中只统计 `mode === 'focus'` 的 session，排除 break
- [ ] 每条 `hourlyBreakdown` 包含 `{ hour, focusMinutes }`
- [ ] `stats/today/detail` 路由正确注册并路由到 `getTodayDetail()`
- [ ] `stats/monthly` 的返回兼容旧前端（新增字段不破坏已有字段）

### 前端

- [ ] `statsAPI.todayDetail()` 可成功调用后端 `stats/today/detail`
- [ ] 日视图使用柱状图（`series.type: 'bar'`），24 小时分桶
- [ ] 周视图保持折线面积图（`series.type: 'line'`）不变
- [ ] 月视图使用折线面积图（`series.type: 'line'`），使用 `monthlyStats.dailyBreakdown`
- [ ] `todayDetail` API 失败时不覆盖已有今日数据，用默认 24 个 0
- [ ] 三视图切换时图表类型正确切换，无渲染残留
- [ ] `_loadStats()` 中 `todayDetail` 请求不参与 `didFail` 判断（新用户无 session 不是错误）
- [ ] 所有图表不展示 fake/hardcoded 数据

---

## 8. 手工验证

1. **日视图有专注**：今天完成几个番茄 → 进入统计页 → 切到"日" → 验证对应小时有柱状条
2. **日视图无专注**：新用户或今天没使用 → 切到"日" → 验证全 0 柱状图，不报错
3. **月视图**：切到"月" → 验证折线图显示整月每日数据
4. **三视图切换**：依次点击日→周→月 → 验证图表类型和数据正确切换
5. **周回归测试**：切回"周" → 验证功能不变
6. **日/月视图空态恢复**：确认"无数据"场景不会导致页面白屏或 JSError
