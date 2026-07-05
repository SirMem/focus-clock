# Issue #3: Stats 统计模块

> **认领人**: @开发者C
> **状态**: 🔲 待开发
> **预估工时**: 3h
> **标签**: `module/stats`, `priority/p1`

---

## 概要

实现四个统计查询接口：今日、本周/某周、本月/某月、年度热力图。为后续统计页和日历热力图提供数据。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §4` | 接口入参/出参定义 |
| `docs/backend-architecture-v2.md §3` | 分层规范 |
| `docs/research/statistics-dashboard-best-practices.md` | 统计面板调研参考 |

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/repositories/daily-summary.repo.js  # 日汇总（若 Issue #2 未创建）

需要修改:
  cloudfunctions/focus-api/routes/stats.routes.js        # 路由处理（替换 stub）
```

## 重要说明

**统计模块不创建独立的 Service 层。** 查询逻辑简单（只有聚合查询），直接在 routes 中调用 Repo 的方法组装返回。这样做是因为：

- 没有需要单元测试的业务规则
- 减少不必要的抽象层级

## 详细实现要求

### 1. `repositories/daily-summary.repo.js`

> 如果 Issue #2 已完成此文件，直接复用，确保 `findByDateRange` 和 `findByMonth` 两个方法可用。

**新增方法**：

| 方法 | 说明 |
|------|------|
| `findByDateRange(openId, startDate, endDate)` | 查询日期范围内的日汇总 |
| `findByMonth(openId, year, month)` | 查询某月所有日汇总 |

**`findByDateRange` 实现**：

```javascript
async findByDateRange(openId, startDate, endDate) {
  const res = await this.collection
    .where({
      _openid: openId,
      date: _.gte(startDate).and(_.lte(endDate)),
    })
    .orderBy('date', 'asc')
    .get();
  return res.data;
}
```

**`findByMonth` 实现**：拼出 `YYYY-MM` 前缀，查询 date 以该前缀开头的记录，或使用 `_.gte(start)_.and(_.lte(end))`。

### 2. `routes/stats.routes.js`

四个路由，均使用 `daily_summaries` 和 `sessions` 集合做统计查询。

#### stats/today

直接从 `daily_summaries` 查当日记录，若没有则返回全零统计。
同时从 `sessions` 查当日会话列表计算当前连续天数（currentStreak）。

**连续天数计算**：

```javascript
// 思路：从昨天往前找，连续有 session 的天数
async function calcStreak(openId) {
  let streak = 0;
  let d = new Date();
  while (true) {
    d.setDate(d.getDate() - 1);
    const dateStr = getDateStr(d);
    const res = await db.collection('sessions')
      .where({ _openid: openId, isPomodoro: true, completedAt: _.gte(startOfDay(d)).and(_.lt(endOfDay(d))) })
      .count();
    if (res.total > 0) streak++;
    else break;
  }
  return streak;
}
```

#### stats/weekly

1. 用请求中的 `weekStart` 或 `getWeekStart()` 计算起始日期
2. 计算一周 7 天的 date 列表: `['2026-06-29', '2026-06-30', ...]`
3. 查 `daily_summaries` 中该范围的数据
4. 把数据填充到 7 天的数组中（无数据的日期返回 0）
5. 返回 `{ days: [...], totalFocusMinutes, totalPomodoros }`

#### stats/monthly

1. 用请求中的 `month` 或 `getMonthStr()` 计算月份
2. `getDaysInMonth(year, month)` 获取当月天数
3. 查 `daily_summaries` 中该月数据
4. 填充到当月每天数组中
5. 返回 `{ days: [...], totalFocusMinutes, totalPomodoros }`

#### stats/heatmap

1. 用请求中的 `year` 或当前年
2. 查该年所有 `daily_summaries`（date 以 `YYYY-` 开头）
3. 返回 `cells: [{ date, count: pomodoroCount }]`（可只返回有数据的天）
4. 同时返回 `maxCount` 为该年单日最大 pomodoroCount

## 验收标准

- [ ] 4 个路由正确返回数据，格式与契约一致
- [ ] `stats/today` 在无数据时返回全零（不报错）
- [ ] `stats/weekly` 和 `stats/monthly` 填充无数据日为 0
- [ ] `stats/heatmap` 的 `cells` 只包含有数据的天
- [ ] 日期边界处理正确（跨月/跨年）

## 提示

- `db.command` 已通过全局中间件注入到 `ctx._`，在路由处理函数中通过 `ctx.db` 和 `ctx._` 访问数据库
- 如果某天的 `daily_summary` 不存在，`findByDateRange` 不会返回该天的记录——前端需要填充 0，或者你可以选择在服务端填充
- **服务端填充**：用 JS 生成日期列表，把查询结果转成 `Map<date, data>`，然后 map 填充。这里用服务端填充，减少前端工作
