# 专注时钟 v1.3 — 架构决策记录 (ADR) 修正版

> 版本：v1.3-rev1
> 日期：2026-06-29
> 状态：已评审
> 基于：框架优先原则，公测上线目标

---

## 决策总览（新旧对比）

| ID | 主题 | 旧决策（已废弃） | ✅ 新决策 |
|----|------|----------------|----------|
| ADR-001 | 数据存储 | 纯前端 wx.getStorageSync | **微信云开发（Cloud Base）** |
| ADR-002 | 图表方案 | 原生 Canvas 自绘 | **echarts-for-weixin** |
| ADR-003 | 数据架构 | Event Sourcing + 预聚合 | ✅ 保留（模式，非库） |
| ADR-004 | 计时器 | 绝对时间戳 | ✅ 保留（正确性设计） |
| ADR-005 | 导航方式 | wx.redirectTo + 自绘 Tab | **app.json tabBar 原生导航** |
| ADR-006 | 四象限 | 计算属性 | ✅ 保留（数据一致性） |
| ADR-007 | AI 评分 | 本地规则引擎 | **DeepSeek API（用户提供中转）** |
| ADR-008 | 用户认证 | 无 | **微信一键登录（云开发鉴权）** |
| ADR-009 | 日记-任务关联 | 快照关联 | ✅ 保留 |
| ADR-010 | 状态管理 | 无 | **全局 Store + 云开发实时同步** |

---

## ADR-001：微信云开发（BaaS）

### 问题
需要为公测用户提供数据持久化、多用户隔离、自动鉴权。

### 决策
使用 **微信云开发（Tencent Cloud Base）** 作为 BaaS 层。

### 为什么选云开发（而非其他 BaaS）
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| ✅ **微信云开发** | 原生集成 wx.login 鉴权、无需额外服务器、自动弹性伸缩、自带 CDN | 需在开发者工具开通 | **采用** |
| ❌ Supabase | 开源、PostgreSQL | 需要额外 API 网关桥接微信登录 | 复杂度高 |
| ❌ LeanCloud | 国内 BaaS、有微信集成 | 付费、非原生微信生态 | 不选 |
| ❌ 自建后端 | 完全控制 | 运维成本高、需服务器 | 不选 |

### 架构示意
```
┌─────────────────────────────────────┐
│           微信小程序                   │
│  wx.cloud.callFunction({ name, data }) │
│  wx.cloud.database().collection(...)   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│         微信云开发环境                 │
│  ┌──────────┐  ┌──────────┐         │
│  │ 云函数    │  │ 云数据库  │         │
│  │ (鉴权/    │  │ (JSON    │         │
│  │  AI代理)  │  │  Document)│         │
│  └──────────┘  └──────────┘         │
│  ┌──────────┐                        │
│  │ 云存储    │                        │
│  │ (图片等)  │                        │
│  └──────────┘                        │
└─────────────────────────────────────┘
```

### 数据集合设计
| 集合名 | 说明 | 权限 |
|--------|------|------|
| `users` | 用户资料（openId, 昵称, 头像, 设置） | 仅本人读写 |
| `focus_sessions` | 番茄完成事件（append-only） | 仅本人读写 |
| `tasks` | 待办任务 | 仅本人读写 |
| `diary_entries` | 日记 | 仅本人读写 |
| `daily_summaries` | 日统计预聚合 | 仅本人读写 |
| `ai_suggestions` | AI 建议记录 | 仅本人读写 |
| `achievements` | 成就/徽章 | 仅本人读写 |

### 本地缓存策略
- 核心数据（当前任务、今日统计）同时缓存在 `wx.getStorageSync`
- 无网络时读取本地缓存，有网络时静默同步到云端
- 冲突解决：以云端时间戳为准

---

## ADR-002：echarts-for-weixin 图表方案

### 问题
统计页需要环形图、曲线面积图、柱状图、热力图，需要丰富的交互（tooltip、动画）。

### 决策
使用 **echarts-for-weixin**（ECharts 官方微信小程序适配版）。

### 为什么选 ECharts
| 方案 | 包体积 | 环图 | 曲线面积图 | 热力图 | Tooltip | 动画 | 维护性 | 结论 |
|------|--------|------|-----------|--------|---------|------|--------|------|
| ✅ **ECharts** | ~200KB（自定义构建） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 官方维护 | **采用** |
| ❌ uCharts | ~120KB | ✅ | ✅ | ❌ 弱 | ✅ | ✅ | 社区维护 | 热力图弱 |
| ❌ 原生 Canvas | ≈0KB | ✅ | ✅ | ✅ | ❌ 自写 | ❌ 自写 | 自维护 | 开发慢 |

### 使用方式
```javascript
// pages/stats/stats.js
import * as echarts from '../../ec-canvas/echarts';

// WXML: <ec-canvas id="trendChart" canvas-id="trendChart" ec="{{ ec }}"></ec-canvas>

onReady() {
  this.trendChart = this.selectComponent('#trendChart');
  this.trendChart.init((canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
    this._setTrendOption(chart);
    return chart;
  });
}
```

### 包体积控制
- 使用 ECharts 自定义构建（只包含需要的图表类型：ring、line、bar、heatmap）
- 体积预估：完整版 ~400KB → 自定义构建 ~200KB
- 放置在分包中（stats 页所在分包），不影响主包加载

### 已实现的 Canvas 原生代码如何处理
- **环图**（`_drawDualRing`, `_drawRing`）→ 替换为 ECharts ring 图表
- **曲线图**（`_drawTrendChart`）→ 替换为 ECharts area 图表
- 保留原生 Canvas 作为备选 / 简单指示器（如页面装饰性圆环）

---

## ADR-003：Event Sourcing + 写时预聚合（保留）

### 问题
统计页需要各种聚合数据（日/周/月趋势），随着数据增长需要保证读取性能。

### 决策
**保留原方案**：Event Sourcing（focus_sessions 只追加不修改）+ 写时预聚合（daily_summaries 在写入时同步更新）。

### 在云开发上的实现
```javascript
// 云函数：completeFocusSession
// 1. 写入 focus_sessions 集合（append-only 事件日志）
// 2. 同步更新 daily_summaries 集合（写时预聚合）
// 3. 更新 tasks 集合中的 pomodorosCompleted
// 4. 检查成就解锁

// focus_sessions 文档结构
{
  _id: string,
  openId: string,       // 用户标识（由云函数自动注入）
  taskId: string|null,  // 关联任务
  mode: 'focus' | 'shortBreak' | 'longBreak',
  startTs: timestamp,
  endTs: timestamp,
  duration: number,     // 实际专注秒数
  interrupted: boolean,
  createdAt: timestamp,
}

// daily_summaries 文档结构
{
  _id: string,          // 格式: "openId_YYYY-MM-DD"
  openId: string,
  date: string,         // "2026-06-29"
  totalPomodoros: number,
  totalFocusMinutes: number,
  totalBreakMinutes: number,
  completedTasks: number,
  totalTasks: number,
  efficiencyScore: number,
  peakHour: number|null,
  updatedAt: timestamp,
}
```

---

## ADR-004：绝对时间戳计时器（保留）

### 问题
番茄钟需要精确倒计时，支持后台恢复、暂停/继续。

### 决策
**保留原方案**：基于绝对时间戳（`targetEndTs - Date.now()`），不依赖 setInterval 累加。

### 后台恢复链路（适配云开发）
```
App.onHide → 保存 timer + 关联任务到本地 Storage + 云函数记录暂停状态
App.onShow → 读取本地 timer → 如果超时 → 触发 complete()
           → 未超时 → 恢复 tick，重新校准
```

---

## ADR-005：原生 tabBar 导航

### 问题
当前使用各页面自绘底部 Tab + `wx.redirectTo` 跳转，无切换动画、代码冗余。

### 决策
改为 **app.json 原生 tabBar** 配置。

### 配置方案
```json
{
  "tabBar": {
    "color": "#8A8A9A",
    "selectedColor": "#4A90D9",
    "backgroundColor": "#FFFFFF",
    "borderStyle": "white",
    "list": [
      { "pagePath": "pages/focus/focus", "text": "专注", "iconPath": "images/tab/focus.png", "selectedIconPath": "images/tab/focus_active.png" },
      { "pagePath": "pages/todo/todo", "text": "待办", "iconPath": "images/tab/todo.png", "selectedIconPath": "images/tab/todo_active.png" },
      { "pagePath": "pages/stats/stats", "text": "统计", "iconPath": "images/tab/stats.png", "selectedIconPath": "images/tab/stats_active.png" },
      { "pagePath": "pages/diary/diary", "text": "日记", "iconPath": "images/tab/diary.png", "selectedIconPath": "images/tab/diary_active.png" },
      { "pagePath": "pages/profile/profile", "text": "我的", "iconPath": "images/tab/profile.png", "selectedIconPath": "images/tab/profile_active.png" }
    ]
  }
}
```

### 变更影响
- 移除所有页面中自绘的 Tab 栏 WXML + WXSS + JS（`TAB_ITEMS`, `onSwitchTab`）
- coach 页不再作为独立 Tab，合并到 profile 页中（或通过 profile 页内的入口跳转）
- 需要准备 10 个 Tab 图标（5 个非活跃 + 5 个活跃）

### 为什么 coach 不单独一个 Tab
- tabBar 最多 5 项，当前已占满
- coach 内容与 profile 相关，作为 profile 页内的子页面更合理

---

## ADR-006：四象限计算属性（保留）

### 问题
待办任务需要显示四象限优先级标签。

### 决策
**保留原方案**：通过 `important` + `urgent` 两个布尔值实时计算象限，不存储为字段。

```javascript
getQuadrant(task) {
  if (task.important && task.urgent) return 'Q1'  // 重要紧急 🔴
  if (task.important && !task.urgent) return 'Q2' // 重要不紧急 🔵
  if (!task.important && task.urgent) return 'Q3' // 紧急不重要 🟡
  return 'Q4' // 不重要不紧急 🟢
}
```

### 补充（云数据库上的计算）
- 云数据库查询结果中，前端计算象限（不在云端存 quadrant 字段）
- 如果需要在云端按象限筛选：用 `where({ important: true, urgent: true })` 查询 Q1

---

## ADR-007：DeepSeek API AI 评分（原本地规则引擎 → 云端 API）

### 问题
AI 教练页需要每日效率评分和智能洞察。

### 决策
用户提供 **DeepSeek 中转 API**，通过云函数代理调用，前端不暴露 API Key。

### 架构
```
小程序 → 云函数(getAIScore) → DeepSeek API（用户提供的中转地址）
                              ↓
                   返回 { score, insight, suggestion }
                              ↓
                   缓存到 daily_summaries.aiScore 字段
```

### 云函数设计
```javascript
// cloud/functions/getAIScore/index.js
const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const { openId } = cloud.getWXContext();  // 自动鉴权
  const { date, statsData } = event;         // 传入今日统计数据

  // 调用 DeepSeek API（中转地址由用户提供）
  const response = await axios.post('https://your-deepseek-relay.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [{
      role: 'system',
      content: '你是一个效率教练。根据用户的番茄统计数据，给出0-100的评分、一句洞察和一条可操作建议。返回JSON格式：{score, insight, suggestion}'
    }, {
      role: 'user',
      content: JSON.stringify(statsData)
    }],
  }, {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
  });

  // 缓存到 daily_summaries
  // 返回给前端
  return response.data;
};
```

### 降级策略
- API 调用失败时 → 使用本地规则引擎兜底（保留简单打分逻辑）
- API 返回慢时 → 前端先显示昨日评分，后台静默刷新

---

## ADR-008：微信一键登录 + 云开发鉴权

### 问题
公测需要用户认证系统，支持多用户数据隔离。

### 决策
使用 **微信云开发原生鉴权系统**，通过 `wx.login` + `cloud.callFunction` 自动获取用户身份。

### 登录流程
```
① 小程序启动 → wx.login() 获取 code
② 调用 wx.cloud.callFunction({ name: 'login' })
③ 云函数内部自动完成 code → openId 交换
④ 返回用户信息（openId 由云开发自动注入，前端不接触 openId）
⑤ 前端存储 cloudID / 自定义登录态
```

### 云函数 login
```javascript
// cloud/functions/login/index.js
const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event, context) => {
  const { OPENID, APPID } = cloud.getWXContext();  // 云开发自动解析

  // 查询或创建用户记录
  const db = cloud.database();
  const users = db.collection('users');
  let user = await users.where({ _openid: OPENID }).get();

  if (user.data.length === 0) {
    // 新用户 → 创建档案
    await users.add({
      data: {
        _openid: OPENID,
        nickName: event.nickName || '微信用户',
        avatarUrl: event.avatarUrl || '',
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate(),
        settings: { defaultFocusMinutes: 25, defaultShortBreak: 5, defaultLongBreak: 15 },
      }
    });
  } else {
    // 老用户 → 更新登录时间
    await users.doc(user.data[0]._id).update({
      data: { lastLoginAt: db.serverDate() }
    });
  }

  // 获取用户头像昵称（需用户授权）
  // 可通过 wx.getUserProfile() 获取后传给云函数

  return { success: true };
};
```

### 数据隔离
- 云数据库安全规则：每个集合配置 `{ openId: { $eq: '{openId}' } }`，自动按用户隔离
- 前端查询时不需要手动传 openId，云函数/数据库安全规则自动注入

---

## ADR-009：日记-任务快照关联（保留）

### 问题
日记页需要显示今日完成的番茄任务，但任务可能被删除。

### 决策
**保留原方案**：日记保存时快照任务文本，不依赖外键。

---

## ADR-010：全局 Store + 云开发同步

### 问题
多个页面需要共享用户状态（登录态、今日统计、当前正在进行的番茄）。

### 决策
使用 **全局 Store 对象**（挂载到 `App` 实例上）+ 云开发实时监听。

### 实现
```javascript
// app.js
App({
  globalData: {
    user: null,
    currentTimer: null,
    todaySummary: null,
    isLoggedIn: false,
  },

  onLaunch() {
    wx.cloud.init({
      env: 'your-env-id',
      traceUser: true,
    });
    this.login();
  },

  async login() {
    const res = await wx.cloud.callFunction({ name: 'login' });
    this.globalData.isLoggedIn = true;
    // 获取用户数据
    this.loadUserData();
  },
});

// 任何页面访问
const app = getApp();
app.globalData.currentTimer  // 获取当前计时状态
```

### 为什么不引入第三方状态管理（MobX/Redux）
- 小程序 Page 数量少（6 页），`App.globalData` 足够
- 云开发更新数据后通过 `getApp().globalData.xxx = newVal; this.setData(...)` 同步
- 如果后续页面增多 → 迁移到 MobX（`npm install mobx-miniprogram`）

---

## 附录 A：技术栈总览

| 层次 | 技术选型 | 说明 |
|------|---------|------|
| **前端框架** | 微信原生小程序（无第三方框架） | 保持与微信生态兼容 |
| **UI 组件** | TDesign Miniprogram | 已在用，TabBar/Cell/Navbar 等 |
| **图表** | **echarts-for-weixin** | 环图 + 曲线面积图 + 柱状图 + 热力图 |
| **BaaS** | **微信云开发** | 数据库 + 云函数 + 云存储 |
| **认证** | 微信云开发自动鉴权 | wx.login 自动获取 openId |
| **AI** | **DeepSeek API**（用户提供中转） | 通过云函数代理调用 |
| **状态管理** | App.globalData | 简单够用 |
| **导航** | app.json tabBar | 原生 5 Tab |
| **存储** | 云数据库 + 本地缓存 | 双写模式 |

## 附录 B：待实施清单（按优先级）

| 优先级 | 任务 | ADR 关联 | 预估工日 |
|--------|------|---------|---------|
| P0 | 开通微信云开发环境 + 初始化 | ADR-001 | 0.5 |
| P0 | 实现 login 云函数 + 用户集合 | ADR-008 | 1 |
| P0 | 配置 app.json tabBar + 准备图标 | ADR-005 | 1 |
| P0 | 集成 echarts-for-weixin + 替换环图/曲线图 | ADR-002 | 2 |
| P0 | 实现 completeFocusSession 云函数（事件写入+预聚合） | ADR-003 | 2 |
| P0 | 改造 focus 页：真实计时器 + 云函数调用 | ADR-004 | 2 |
| P1 | 实现 todo CRUD 云函数 + 四象限 | ADR-006 | 1.5 |
| P1 | 实现 diary 云函数 + 情绪/任务关联 | ADR-009 | 1.5 |
| P1 | 实现 getAIScore 云函数（接 DeepSeek） | ADR-007 | 1.5 |
| P1 | 实现 profile 页（用户资料 + coach 子页面） | ADR-005/010 | 1 |
| P2 | 离线缓存 + 网络状态监听 | ADR-001 | 1 |
| P2 | 移除各页面自绘 Tab 代码 | ADR-005 | 0.5 |
