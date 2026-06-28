# 调研报告：统计看板模块 — 行业最佳实践

> 生成时间：2026-06-19
> 调研方式：Grok-4.20-multi-agent-xhigh 深度搜索 + 多源交叉验证
> 前提背景：微信小程序「专注时钟」，纯本地存储（wx.getStorageSync），无后端/无云服务/无登录

---

## 目录

1. [最佳实践源代码](#一最佳实践源代码)
2. [图表方案对比](#二图表方案对比)
3. [设计哲学分析](#三设计哲学分析)
4. [架构哲学分析](#四架构哲学分析)
5. [综合推荐方案](#五综合推荐方案)
6. [实施路线图](#六实施路线图)

---

## 一、最佳实践源代码

### 1.1 微信小程序番茄钟/专注类应用（含统计看板）

| 项目 | 链接 | 核心价值 |
|------|------|----------|
| **zhengronggui666/tomatoClock** | https://github.com/zhengronggui666/tomatoClock | 番茄时钟 + 事务便签 + **效率统计**，聚焦统计看板，可参考每日/总体效率计算和展示 |
| **shisaq/wechat-pomodoro** | https://github.com/shisaq/wechat-pomodoro | 早期经典，含每日数据统计、自定义时长、`onHide`/`onShow` 动态存储逻辑。虽有登录规划但核心是本地存储 |
| **liwanzhong/myfocus** | https://github.com/liwanzhong/myfocus | uni-app 番茄钟 + 效率工具 |
| **Splode/pomotroid**（非小程序，UI/模式参考） | https://github.com/Splode/pomotroid | Electron 应用，**最佳可视化设计参考**：每日摘要、小时分布柱状图、周趋势、52 周热力图（GitHub-style）、streak 计数器。强烈推荐复制其可视化布局和激励设计 |

### 1.2 统计看板视觉设计模式

根据 pomotroid 和同类项目总结的看板布局模式：

**四视图结构：**
- **日视图**：环形图（完成率）+ 详细小时分布 + 今日摘要卡片
- **周视图**：柱状图（每天番茄数）+ streak（连续天数）+ 周总计
- **月视图**：趋势折线图 + 月汇总 + 峰值生产力小时分析
- **年视图**：GitHub-style 热力图（颜色深度 = 完成强度）

**核心图表类型：**
- 环形图（今日/本周完成率，内外环区分工作/休息）
- 趋势折线图（平滑曲线 + 标记点 + tooltip）
- 柱状图（周分布/小时分布）
- 热力图（年度一致性）

---

## 二、图表方案对比

### 2.1 2025-2026 微信小程序图表方案

| 方案 | 包体积 | 优点 | 缺点 | 推荐场景 |
|------|--------|------|------|----------|
| **uCharts** 🥇 | ~100-120KB | Canvas-based，专为小程序优化，性能优秀，触控良好，开箱即用，社区活跃 | 可定制性不如 ECharts | **主力推荐**：环形图 + 趋势线 + 柱状图组合 |
| **echarts-for-weixin** | ~400KB（自定义构建可降至150-250KB） | 功能最完整，丰富交互（tooltip/zoom/动画/主题），ECharts 生态，官方维护 | 加载较重，需结合分包策略 | 需要复杂可视化、深度可定制时 |
| **wx-charts** | ~20-80KB | 极致轻量，API 简单，直接 `new wxCharts({type:'ring'})` | 定制性弱，兼容性问题多，维护滞后 | 仅限 MVP 或极致体积控制 |

### 2.2 推荐策略

**优先 uCharts**（包体积 vs 功能最佳平衡）。若需：
- 极致定制 / 复杂可视化（动态热力图、ECharts 生态扩展）→ **自定义构建 echarts-for-weixin + Canvas 2D**
- 极简 MVP → **wx-charts**

**关键性能实践：**
- 避免每次页面 `onLoad` 完整 re-init 图表
- 使用 `chart.setOption({series: [...]})` 增量更新数据
- 在组件中缓存 chart 实例
- 页面卸载时 `chart.dispose()` 防内存泄漏

---

## 三、设计哲学分析

### 3.1 读时计算 vs 写时预聚合

| 维度 | 读时计算（当前项目方式） | 写时预聚合（推荐） |
|------|------------------------|-------------------|
| 实现复杂度 | 简单：只存 raw events，查询时 reduce/groupBy | 稍复杂：需维护投影一致性 |
| 读取性能 | 数据量增长后卡顿（数百事件→页面渲染阻塞） | 读时 O(1) 或极快 |
| 数据一致性 | 始终一致 | 需定期回放校验 |
| 审计能力 | 强（原始数据完整） | 弱（需配合 Event Store） |
| 写性能 | 无额外开销 | 每次操作有约 ~5ms 聚合开销 |

**微信小程序场景结论：写时预聚合 + 定期回放校验**

日常看板用预聚合（O(1) 读取），年度审计/数据迁移时回放 events 重算。结合 Event Sourcing 实现最终一致性。

### 3.2 图表组件选择哲学

**轻量哲学**（wx-charts/uCharts）：
- 尊重小程序包体积限制（主包 ≤2MB）
- 启动快、内存低
- 适合工具型应用：用户打开看数据就走

**完整哲学**（ECharts）：
- 追求激励与沉浸感
- 丰富的 tooltip、平滑动画、个性化配色、主题切换
- 这些是让用户 "wow" 的关键因素

**混合推荐**：核心图用 uCharts 或 ECharts，简单指示器用原生 Canvas 或纯 CSS 环形。

### 3.3 用户激励设计心理学

三大核心原则：

1. **可见进步（Progress Principle）**
   - 大数字展示（本月番茄数、总专注小时）
   - 进度环 + streak 计数器（当前/最长连胜）
   - → 激活多巴胺，形成习惯正循环

2. **游戏化元素**
   - GitHub 式热力图：颜色深度 = 完成强度，"连续绿块" 形成视觉奖励
   - 等级/徽章系统：100 番茄解锁 "专注大师"
   - 过去自我比较："本周比上周多 23%"
   - 峰值生产力洞察："你下午 3 点最专注"

3. **间隔强化（Spaced Reinforcement）**
   - 定期回顾（每日/每周摘要卡片）强化习惯
   - 分享卡片（生成图片）放大社会证明效应

**理论依据**：自我决定理论（SDT）——通过可视化满足用户的胜任感（Competence）和自主感（Autonomy）。

---

## 四、架构哲学分析

### 4.1 数据流架构：Event Sourcing + CQRS 风格

#### 实体划分

| 实体 | 类型 | 说明 |
|------|------|------|
| `FocusSession` | 原始事件（Event） | 不可变日志，append-only |
| `TaskCompletion` | 关联实体 | 待办完成记录，引用 taskId |
| `DailySummary` | 物化视图（Projection） | 日汇总：番茄数、专注分钟、完成率 |
| `WeeklySummary` | 物化视图（Projection） | 周汇总：趋势、streak、峰值时段 |

#### 架构流程

```
[Timer Module]                 [Todo Module]
      |                             |
      └── SessionCompleted ────────┘
                  ↓
         [Event Store]
       (focusEvents[], append-only)
                  ↓
       写入时投影（Write-time Projection）
                  ↓
       [Materialized Views]
   (dailySummaries, monthlySummaries)
                  ↓
        按需 / 缓存读取
                  ↓
       [ViewModel / Chart Options]
                  ↓
       [uCharts / ECharts Component]
```

#### 核心原则

- **Command**（完成番茄）→ 更新 Event Store + 同步投影到聚合层
- **Query**（看板）→ 只读聚合层 / ViewModel
- 比纯 Snapshot 更具扩展性：未来加新指标只需新投影函数
- 纯函数投影 `projectEventsToDaily(events)` 可做定期一致性校验

### 4.2 本地存储分层设计

| 层级 | Storage Key | 数据结构 | 操作模式 |
|------|------------|----------|----------|
| **原始日志层** | `focusEvents` | `Array<FocusSessionEvent>` | append-only，永不 mutation |
| **聚合层** | `dailySummaries` | `Map<YYYY-MM-DD, DailySummary>` | 写时增量更新（+1 而非全量 recalculate） |
| **展示层** | 内存缓存 | `chartOptions`（ECharts/uCharts option 对象） | 从聚合层按需生成，按 version 失效 |

**转换规则链：**
```
completeSession(event)
  → appendToEvents(event)
  → updateMaterializedViews(event)
  → invalidateViewModelCache()
```

### 4.3 无后端场景的架构边界

#### 模块自治原则

- **统计模块完全自治**：只读写自己的 storage keys（或通过统一 `StorageService` 门面）
- 不直接 mutation 其他模块数据
- 暴露 `recordSession()` 和 `getDashboardData()` 作为公共 API

#### 耦合边界

| 方向 | 关系 | 实现方式 |
|------|------|----------|
| Timer → Stats | 单向依赖 | 事件总线 / Pub-Sub / 直接调用 Stats.recordSession() |
| Todo → Stats | 单向依赖 | 提供 taskId 关联，不反向依赖 |
| Stats → Timer | ❌ 不允许 | 统计模块不反向依赖计时器 |

#### 数据一致性保障（纯本地场景）

- 写操作包裹 try-catch + 版本号检查
- 使用 `wx.setStorageSync` 的原子性（单次 key 操作）
- 定期轻量校验（看板打开时 5% 概率触发回放重算）
- 冲突时以 Event Store 为 source of truth 回放修复

---

## 五、综合推荐方案

| 决策点 | 推荐方案 | 理由 |
|--------|----------|------|
| 图表库 | **uCharts**（首选）或 **echarts-for-weixin**（复杂场景） | uCharts 包体积/功能平衡最佳；ECharts 用于热力图等复杂图 |
| 数据写入策略 | **写时预聚合** | 小程序读性能敏感，避免看板卡顿 |
| 数据溯源 | **Event Sourcing** | 保留完整审计历史，支持未来新指标 |
| 分层架构 | **3 层：Event Store → Materialized View → ViewModel** | 解耦清晰，每层可独立测试 |
| 模块通信 | **事件总线单向** | Timer → Stats 只单向，防止循环依赖 |
| 激励设计 | **热力图 + streak + 大数字 + 周趋势线** | 多巴胺驱动习惯养成 |

### 到 4 个核心模块的衔接

统计看板与其他模块的衔接方式：

| 数据来源 | 事件类型 | 统计模块处理 |
|----------|----------|-------------|
| 番茄钟完成 | `SESSION_COMPLETED` | 写入 focusEvents + 自增 dailySummary |
| 待办完成 | `TASK_COMPLETED` | 记录完成率 + 关联 session |
| 番茄钟中断 | `SESSION_INTERRUPTED` | 标记异常，影响完成率统计 |
| 日记记录 | 暂不关联 | 未来可加"专注时写日记字数"统计 |

---

## 六、实施路线图

建议分 4 步走，每步可独立发布：

```
Phase 1 ─ 存储重构（1-2 天）
  ├── 定义 Event Store 数据结构（FocusSessionEvent Schema）
  ├── 实现 append-only 写入 + 写时预聚合
  └── 保持旧版日志向前兼容

Phase 2 ─ 图表接入（2-3 天）
  ├── 引入 uCharts（或 echarts-for-weixin）
  ├── 实现环形图（今日完成率）
  ├── 实现趋势折线图（周/月）
  └── 实现柱状图（周分布）

Phase 3 ─ 激励设计（1-2 天）
  ├── streak 计数器（当前/最长连胜）
  ├── 年度热力图（GitHub-style）
  └── 成就/徽章系统

Phase 4 ─ 一致性保障（1 天）
  ├── 回放校验机制
  ├── 版本冲突检测
  └── 缓存失效策略
```

---

## 附录：关键引用来源

| 来源 | 链接 |
|------|------|
| uCharts 官网 | https://www.ucharts.cn/ |
| uCharts GitHub | https://github.com/16cheng/uCharts |
| echarts-for-weixin | https://github.com/ecomfe/echarts-for-weixin |
| ECharts 自定义构建 | https://echarts.apache.org/zh/builder.html |
| wx-charts | https://github.com/xiaolin3303/wx-charts |
| pomotroid（UI 参考） | https://github.com/Splode/pomotroid |
| ECharts 微信小程序实践 | https://echarts.apache.org/handbook/zh/how-to/cross-platform/wechat-app/ |
| 离线优先 Event Sourcing | https://flpvsk.com/blog/2019-07-20-offline-first-apps-event-sourcing/ |
