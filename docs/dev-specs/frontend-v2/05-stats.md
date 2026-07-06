# 05-stats — Stats 页真实统计数据对接（救援版）

> 状态: 🚧 需修复
> 契约来源: [`../../api-contracts.md`](../../api-contracts.md) §5
> 目标: 统计页只能展示真实 `stats/*` 数据或诚实空态，禁止用 mock 趋势冒充真实数据。

---

## 1. 依赖

必须已完成或确认：

- `01-api-foundation.md`：`stats.api.js`, `request.js`, `formatDuration`
- `04-focus-session.md`：`session/complete` 会更新 `daily_summaries`
- `docs/api-contracts.md`：Stats canonical contract 已冻结

---

## 2. 允许修改文件

| 文件 | 内容 |
|---|---|
| `pages/stats/stats.js` | 真实 API 数据映射、图表更新、空态、错误处理 |
| `pages/stats/stats.wxml` | 仅在缺少空态/绑定字段时少量修改 |
| `pages/stats/stats.wxss` | 仅在新增空态样式时少量修改 |
| `miniprogram/api/mappers.js` | 可选：新增 stats/heatmap 视图映射工具 |

不建议为 P0 扩展后端，除非产品明确要求月内每日趋势。

---

## 3. 当前问题

当前 Stats 页已调用：

- `statsAPI.today()`
- `statsAPI.weekly()`
- `statsAPI.monthly()`
- `statsAPI.heatmap(year, month)`

但仍存在质量阻塞：

1. `_refreshTrendChart(period)` 仍含 hardcoded trend arrays。
2. heatmap 前端读取 `count` / `value` 或 fallback `1`，但后端返回 `focusMinutes`。
3. score 前端读取 `score` / `insight`，但后端返回 `aiScore`。
4. focus/rest ring、task ring 读取了后端没有的字段，容易误导用户。
5. loaded API state 不应只直接写 `this.data`，绑定数据应通过 `setData`。

---

## 4. Canonical 数据来源

### `stats/today`

```js
{
  focusMinutes: number,
  pomodoroCount: number,
  completedTasks: number,
  aiScore?: number
}
```

页面用途：

- 今日专注：`focusMinutes`
- 今日番茄：`pomodoroCount`
- 完成任务：`completedTasks`
- AI 分数：`aiScore ?? null`

### `stats/weekly`

```js
{
  totalFocusMinutes: number,
  totalPomodoros: number,
  avgDailyFocus: number,
  activeDays: number,
  dailyBreakdown: [
    { date: 'YYYY-MM-DD', focusMinutes: number, pomodoroCount: number }
  ]
}
```

页面用途：

- 周趋势图唯一真实来源：`dailyBreakdown`

### `stats/monthly`

```js
{
  totalFocusMinutes: number,
  totalPomodoros: number,
  avgDailyFocus: number,
  activeDays: number,
  totalDays: number,
  completionRate: number
}
```

页面用途：

- 本月活跃天数
- 本月汇总
- 完成率

注意：当前没有月内每日 breakdown，不能 fake 月趋势。

### `stats/heatmap`

```js
[
  { date: 'YYYY-MM-DD', focusMinutes: number }
]
```

页面用途：

- 热力图强度来自 `focusMinutes`

建议分档：

```js
0        -> level 0
1-24     -> level 1
25-59    -> level 2
60-119   -> level 3
120+     -> level 4
```

---

## 5. 必须实现/调整

### 5.1 `_loadStats()`

要求：

1. `loading=true`
2. 并行请求 today / weekly / monthly / heatmap
3. 检查每个响应 `code === 0`
4. 使用 `setData` 写入：
   - `todayStats`
   - `weeklyStats`
   - `monthlyStats`
   - `heatmapData`
5. 调用更新函数：
   - `_updateSummaryCards()`
   - `_updateTrendChart()`
   - `_updateHeatmap()`
   - `_updateScoreCard()`
6. 失败 toast：`加载统计数据失败`
7. finally `loading=false`

### 5.2 `_updateSummaryCards()`

从真实字段构建：

```js
[
  { icon: '⏱', value: formatDuration(today.focusMinutes || 0), label: '专注时长' },
  { icon: '🍅', value: `${today.pomodoroCount || 0} 个`, label: '完成番茄' },
  { icon: '✅', value: `${Math.round((monthly.completionRate || 0) * 100)}%`, label: '完成率' }
]
```

如果 `monthly` 为空，完成率显示 `0%`。

### 5.3 `_updateTrendChart()`

只允许使用：

```js
weeklyStats.dailyBreakdown
```

无数据时：

- chart 设置空数组或 0 数组；
- 页面显示“完成一次专注后生成趋势”；
- 不得 fallback 到 hardcoded 周一到周日假数据。

### 5.4 `onPeriodChange()` / `_refreshTrendChart(period)`

P0 建议：

- `week`：显示真实 `weekly.dailyBreakdown`。
- `day`：显示空态或禁用，原因是后端没有小时级接口。
- `month`：显示空态或只显示月汇总，原因是后端没有月内每日 breakdown。

禁止：

```js
[
  { label: '6时', value: 2 }, ...
]
```

这类 hardcoded arrays 不能作为真实数据展示。

### 5.5 `_updateHeatmap()`

必须使用：

```js
item.focusMinutes
```

禁止把 `item.count || item.value || 1` 作为主逻辑。

### 5.6 `_updateScoreCard()`

必须使用：

```js
todayStats.aiScore
```

规则：

- `aiScore` 为数字时显示分数。
- `aiScore` 缺失时显示 `暂无数据`，不要默认显示 0 分造成误导。
- `insight` 若后端未提供，可用本地派生文案，例如：
  - 无数据：`完成一次专注后生成分析`
  - 有分数：`基于今日专注数据生成`

---

## 6. 禁止

- 禁止保留 hardcoded trend arrays 作为实际展示数据。
- 禁止 stats 页只调用 API 但图表仍使用 mock。
- 禁止 heatmap 用 `count/value/fallback 1` 冒充 `focusMinutes`。
- 禁止读取 `score/insight` 作为后端字段。
- 禁止吞掉 API 错误，失败时至少 toast。

---

## 7. 验收检查

- [ ] `statsAPI.today/weekly/monthly/heatmap` 都被使用。
- [ ] `_loadStats()` 检查 `code === 0`。
- [ ] `todayStats/weeklyStats/monthlyStats/heatmapData` 通过 `setData` 更新。
- [ ] 周趋势来自 `weekly.dailyBreakdown`。
- [ ] day/month 趋势没有 fake data。
- [ ] heatmap 强度来自 `focusMinutes`。
- [ ] score 来自 `aiScore` 或显示空态。
- [ ] 无数据时显示 0/空态，不报错。
- [ ] API 失败时 toast。

---

## 8. 手工验证

1. 新用户无数据进入 Stats：显示 0/空态，不显示 fake 趋势。
2. 完成一次 focus session 后进入 Stats：今日专注和番茄数变化。
3. 周趋势当前日期有真实 focusMinutes。
4. 热力图当前日期强度反映 focusMinutes。
5. aiScore 缺失时显示空态，不显示虚假 0 分。
