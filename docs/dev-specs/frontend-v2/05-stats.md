# 05-stats — Stats 页真实统计数据对接

## 依赖

必须在以下 spec 完成后执行：

- `01-api-foundation.md`
- `04-focus-session.md`

原因：Stats 页需要读取真实 daily_summaries，而 daily_summaries 由 session/complete 写入。

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/stats/stats.js` | 用 statsAPI 数据替换图表与统计卡片 mock |

不要修改 WXML/WXSS，除非当前 WXML 缺少数据绑定字段。

---

## 当前问题

当前 Stats 页：

- ECharts 折线图使用硬编码数组
- 总览卡片、热力图、月统计使用 mock
- 没有调用 `stats/today/weekly/monthly/heatmap`

---

## 必须引入

```javascript
const statsAPI = require('../../miniprogram/api/stats.api');
const { formatDuration } = require('../../miniprogram/api/mappers');
```

---

## data 必须包含

```javascript
loading: false,
todayStats: null,
weeklyStats: null,
monthlyStats: null,
heatmapData: [],
```

保留页面已有图表配置字段。

---

## 必须实现方法

### `_loadStats()`

并行调用：

```javascript
const [today, weekly, monthly, heatmap] = await Promise.all([
  statsAPI.today(),
  statsAPI.weekly(),
  statsAPI.monthly(),
  statsAPI.heatmap(year, month),
]);
```

成功后：

- 更新 todayStats / weeklyStats / monthlyStats / heatmapData
- 调 `_updateSummaryCards()`
- 调 `_updateTrendChart()`

### `_updateSummaryCards()`

把 today/monthly 转换到页面卡片：

- 今日专注：`formatDuration(today.focusMinutes)`
- 今日番茄：`${today.pomodoroCount} 个`
- 本月活跃：`${monthly.activeDays}/${monthly.totalDays} 天`
- 完成率：`${Math.round(monthly.completionRate * 100)}%`

### `_updateTrendChart()`

用 `weekly.dailyBreakdown` 替换 ECharts 的硬编码数据。

每日 label 可用日期的最后两位：`07-05 → 5日`

---

## 图表初始化注意

如果当前图表初始化函数 `initTrendChart` 写死 data 数组：

- 改成读取页面传入数据，或
- 初始化后在 `_updateTrendChart` 调 `chart.setOption({ series: [{ data }], xAxis: { data: labels } })`

不要保持硬编码数据。

---

## 禁止

- 禁止保留折线图硬编码 7 天数组作为实际展示数据
- 禁止 stats 页只调用 API 但不更新图表
- 禁止吞掉 API 错误，失败时至少 toast

---

## 验收检查

- [ ] stats.js 引入 `statsAPI`
- [ ] onLoad 调用 `_loadStats()`
- [ ] `statsAPI.today/weekly/monthly/heatmap` 都被使用
- [ ] 折线图数据来自 `weekly.dailyBreakdown`
- [ ] 统计卡片来自真实 API 数据
- [ ] 无数据时显示 0，不报错
