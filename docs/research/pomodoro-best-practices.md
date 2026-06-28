# 番茄时钟模块最佳实践调研报告

> 调研时间：2026-06-19
> 调研工具：Grok-4.20-multi-agent-xhigh（通过 SSH MCP）
> 原始项目：WXminiprogram-Focus-clock-master
> 阅读基础：[prd.md](../basic/prd.md)、[module-plan-v1.md](../module-plan-v1.md)

---

## 目录

1. [最优实践源码参考](#1-最优实践源码参考)
2. [倒计时可靠实现](#2-倒计时可靠实现)
3. [圆形进度方案对比](#3-圆形进度方案对比)
4. [白噪音与音效实现](#4-白噪音与音效实现)
5. [振动反馈实现](#5-振动反馈实现)
6. [设计哲学思想](#6-设计哲学思想)
7. [架构哲学思想](#7-架构哲学思想)
8. [推荐架构总结](#8-推荐架构总结)

---

## 1. 最优实践源码参考

### GitHub 开源项目推荐

| 项目 | Stars | 技术栈 | 特点 |
|------|-------|--------|------|
| [realyao/WXminiprogram-Focus-clock](https://github.com/realyao/WXminiprogram-Focus-clock) | ~726 | 原生 WX + WEUI + Vant | 综合番茄钟，含待办/打卡/图表统计/白噪音/排行榜 |
| [ououpao/timer](https://github.com/ououpao/timer) | ~383 | 原生 WX | 经典小程序番茄时钟，pages/utils/app 结构，纯 JS |
| [shisaq/wechat-pomodoro](https://github.com/shisaq/wechat-pomodoro) | ~8 | 原生 WX + CSS3 | 25/5 循环，CSS3 动画时钟，讨论了小程序生命周期问题 |
| [liwanzhong/myfocus](https://github.com/liwanzhong/myfocus) | — | uni-app/Vue | 跨平台（可编译到微信小程序），含任务/噪声/跨端编译 |
| lucaszhu2zgf/mp-progress | — | Canvas | ~7KB Canvas 圆形进度条辅助库 |

### 核心参考

- **realyao/WXminiprogram-Focus-clock** 是当前项目**同名参考**，star 数最高，功能最全（含白噪音、图表、排行榜），是最直接的参考对像
- **ououpao/timer** 结构更简洁，适合理解核心番茄钟逻辑的最小实现
- **shisaq/wechat-pomodoro** 虽然 star 少，但明确讨论了小程序「用完即走」生命周期问题和 CSS 动画方案

---

## 2. 倒计时可靠实现

### 核心问题

微信小程序中，JavaScript 在后台运行约 **5 秒后被严重节流或暂停**。`setInterval`/`setTimeout` 在后台不保证执行。

### 最佳实践：基于绝对时间戳的倒计时

**不要**依赖每秒递减的计数器作为时间源。**而是**全部基于绝对时间戳计算剩余时间。

```
┌─────────────────────────────────────────┐
│            TimerState                    │
│  startTs: number (开始时间戳)            │
│  totalMs: number (总时长 ms)             │
│  pausedDuration: number (已暂停累计)     │
│  targetEndTs: number (目标结束时间戳)    │
│  isRunning: boolean                      │
│  mode: 'work' | 'break'                 │
└─────────────────────────────────────────┘
```

#### 核心实现模式

```javascript
// services/timer.js
class PomodoroTimer {
  constructor(onTick, onComplete) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.state = {
      mode: 'work',
      totalMs: 25 * 60 * 1000,
      startTs: null,
      pausedDuration: 0,
      isRunning: false
    };
    this.targetEndTs = null;
  }

  start() {
    const now = Date.now();
    this.state.startTs = now;
    this.targetEndTs = now + this.state.totalMs - this.state.pausedDuration;
    this.state.isRunning = true;
    wx.setStorageSync('currentTimer', {
      ...this.state,
      targetEndTs: this.targetEndTs
    });
    this._startTick();
  }

  _tick() {
    if (!this.targetEndTs) return;
    const remaining = Math.max(0, Math.ceil((this.targetEndTs - Date.now()) / 1000));
    this.onTick(this._formatTime(remaining), this._getProgress(remaining));
    if (remaining <= 0) this.complete();
  }

  // 后台恢复 - 在 App.onShow / Page.onShow 中调用
  recoverFromBackground() {
    const saved = wx.getStorageSync('currentTimer');
    if (!saved || !saved.targetEndTs || !saved.isRunning) return false;

    const now = Date.now();
    const remainingMs = saved.targetEndTs - now;

    if (remainingMs <= 0) {
      this.complete(); // 后台已完成
      return true;
    }

    // 重新校准：startTs 前移减去已过去的时间
    this.state = {
      ...saved,
      startTs: now - (saved.totalMs - remainingMs)
    };
    this.targetEndTs = saved.targetEndTs;
    this._startTick();
    return true;
  }

  _startTick() {
    // 每 1 秒根据绝对时间戳算剩余，无累积误差
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  pause() {
    clearInterval(this.intervalId);
    this.state.isRunning = false;
    wx.setStorageSync('currentTimer', this.state);
  }

  complete() {
    this.pause();
    this.onComplete(this.state.mode);
    // 记录不可变事件（见事件溯源模式）
  }
}
```

### 后台恢复链路

```
App.onHide → 保存 timer 快照到 Storage
  ↓
App.onShow → timer.recoverFromBackground()
  ↓
  读取 saved.targetEndTs
    ├─ 已过期 → 触发 complete()
    └─ 未过期 → 重新校准 startTs，继续 tick
```

### 其他重要点

- `wx.setKeepScreenOn({ keepScreenOn: true })` — 保持屏幕常亮
- 如需后台较长时间存活，可尝试 `wx.getBackgroundAudioManager()` 播放无声音频（但有政策限制）
- **不要在 setData 中频繁传大量数据**— 微信小程序 setData 是全量 diff，批量更新

---

## 3. 圆形进度方案对比

| 方案 | 性能 | 灵活性 | 复杂度 | 推荐场景 |
|------|------|--------|--------|----------|
| **Canvas** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中等 | ★ 推荐主方案：动态计时器、多色环、自定义效果 |
| SVG | ⭐⭐⭐⭐ | ⭐⭐⭐ | 低 | 简单圆环、纯矢量缩放、声明式写法 |
| CSS conic-gradient | ⭐⭐⭐⭐⭐ | ⭐⭐ | 最低 | 极简场景、新版本微信、追求最低 CPU 开销 |

### Canvas 方案（推荐）

```javascript
// components/circle-progress/index.js
drawProgress(progress) {
  const query = wx.createSelectorQuery().in(this);
  query.select('#canvas')
    .fields({ node: true })
    .exec((res) => {
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);

      // 底环
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 8;
      ctx.stroke();

      // 进度环
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 中间文字
      ctx.font = '48px sans-serif';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText(this.data.displayTime, cx, cy + 16);
    });
}
```

**优点**：完全的绘制控制、渐变/动画轻松实现、可以和倒计时文字集成在同一 canvas
**注意**：每次 tick 重绘（500ms-1000ms 间隔足够），使用 `requestAnimationFrame` 可优化

### CSS 方案（备选：轻量场景）

```css
/* 利用 conic-gradient + mask */
.circle-progress {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  /* 用 WXSS 变量控制进度 */
  background: conic-gradient(
    #4A90D9 calc(var(--progress) * 1%),
    #e0e0e0 calc(var(--progress) * 1%)
  );
}
```

### SVG 方案（备选：声明式） 

```html
<svg width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="90" fill="none" stroke="#e0e0e0" stroke-width="8"/>
  <circle cx="100" cy="100" r="90" fill="none" stroke="#4A90D9" stroke-width="8"
    stroke-dasharray="565.48"
    stroke-dashoffset="{{dashOffset}}"
    stroke-linecap="round"
    transform="rotate(-90 100 100)"/>
</svg>
```

---

## 4. 白噪音与音效实现

### 推荐方案：InnerAudioContext

```javascript
// services/SoundManager.js
class SoundManager {
  constructor() {
    this.audio = wx.createInnerAudioContext();
    this.audio.loop = true;
    this.tracks = {
      rain: 'assets/rain.mp3',
      brownNoise: 'assets/brown-noise.mp3',
      lofi: 'assets/lofi.mp3'
    };
    this.currentTrack = null;
    this.volume = 0.3;
  }

  play(trackKey = 'brownNoise') {
    if (this.currentTrack === trackKey && !this.audio.paused) return;
    this.audio.src = this.tracks[trackKey];
    this.audio.volume = this.volume;
    this.audio.play();
    this.currentTrack = trackKey;
  }

  pause() { this.audio.pause(); }
  setVolume(v) { this.volume = v; this.audio.volume = v; }
}
```

### 最佳实践要点

- **音频文件**：打包 MP3/AAC（控制体积），或托管到云存储
- **循环播放**：设置 `loop: true`，或用 `onEnded` 触发重播
- **后台播放**：`wx.getBackgroundAudioManager()` 可在后台持续播放，但也受微信策略限制
- **打断处理**：监听 `onInterruptionBegin`/`onInterruptionEnd` 处理电话打断
- **保持常亮**：音效 + `wx.setKeepScreenOn` 结合，尽可能延长前台活跃
- **用户控制**：音量滑块 + 音效开关 + 音轨选择

---

## 5. 振动反馈实现

```javascript
// 仅在关键过渡时振动
function vibrateOnComplete() {
  wx.vibrateShort({ type: 'medium' });  // 'heavy' | 'medium' | 'light'
}

function vibrateLong() {
  wx.vibrateLong();
}
```

### 振动设计原则

| 事件 | 振动类型 | 说明 |
|------|----------|------|
| 番茄钟完成 | `medium` 或 `heavy` | 强反馈，提醒用户 |
| 番茄钟开始 | `light`（可选） | 轻反馈，确认开始 |
| 暂停/停止 | 不振动 | 用户主动操作不需要 |
| 每秒 tick | ❌ 不振动 | 电池杀手 + 用户厌恶 |

- **必须**提供全局开关（settings 中可关闭）
- 调用前检查 `wx.canIUse('vibrateShort')`
- 配合音频提示音一起使用（完成时：音效 + 振动）

---

## 6. 设计哲学思想

### 6.1 为什么 25 分钟是黄金时长

| 依据 | 说明 |
|------|------|
| 经验起源 | Francesco Cirillo 用厨房定时器实验得出，25 分钟是最佳爆发区间 |
| 认知心理学 | 持续注意力研究（Mackworth 1948）表明 20-30 分钟后表现下降 15-30% |
| 心流门槛 | 一般需要 15+ 分钟进入心流，25 分钟刚好覆盖 + 保持压力 |
| 蔡格尼克效应 | 短时间块降低未完成任务的心理负担 |
| 超日节律 | 4 个番茄 ≈ 100 分钟工作 + 休息，匹配 90-120 分钟超日节律 |
| 习惯养成 | 25 分钟对初学者友好，降低心理门槛 |

> **设计启示**：允许用户自定义时长（15/25/30/45/52min），但默认 25 分钟。这是产品的"默认契约"。

### 6.2 打断管理哲学

```
内部打断（走神/突发想法）    外部打断（通知/人/消息）
        │                           │
        └─────── 记录到清单 ────────┘
                    │
            ┌───────┴───────┐
            │               │
        "橘子法"标记     立即记录后返回
        下一个番茄处理    不要在番茄内处理
```

**设计启示**：
- 番茄钟不应阻止打断，而应**使其可见化**
- 提供「记录打断」按钮 — 快速录入想法，不打断当前时钟
- 打断列表在休息时显示，帮助用户反思
- 外部打断需要有「保护当前番茄」的 UX 暗示

### 6.3 心流状态与计时器的关系

心流需要：**清晰目标 + 即时反馈 + 挑战-技能平衡**

番茄钟恰好提供了这三者：
- **目标**：这个番茄我要完成 X
- **反馈**：倒计时 + 进度环 + 完成音效
- **挑战平衡**：25 分钟块大小合适

> **设计启示**：允许「流模式」扩展 — 当番茄钟结束时如果用户想继续，不强制休息，而是扩展当前番茄（不做默认，而是可选）。但建议保持默认结构以降低决策疲劳。

### 6.4 数据最小化设计

对于纯本地存储的无后端小程序：

```
原则：只存不可变事件，不存冗余派生值

存储的内容：
  ✓ 事件日志（时间戳 + 事件类型 + 可选关联）
  ✓ 用户设置（时长、音效、主题）
  ✓ 待办列表（如果有）

不存储：
  ✗ 每秒计时器状态（用绝对时间戳推导）
  ✗ 预计算统计缓存（可以从事件日志推出，但为性能可缓存每日快照）
  ✗ 无意义的使用追踪
```

---

## 7. 架构哲学思想

### 7.1 前端状态管理架构

```
┌──────────────────────────────────────────────┐
│                   App                        │
│   globalData: { timer, settings, userInfo }  │
│   onShow: recoverTimer()                     │
│   onHide: saveTimerSnapshot()                │
└──────────┬───────────────────────────────────┘
           │ 通过 EventBus 通信（非直接耦合）
           ▼
┌──────────────────────────────────────────────┐
│              EventBus (PubSub)               │
│   events: tick | stateChange | complete      │
│           | sessionLogged | interrupt        │
└──────┬──────────┬──────────┬─────────────────┘
       │          │          │
       ▼          ▼          ▼
   TimerPage   TodosPage   StatsPage
   (订阅tick)  (订阅complete)  (订阅eventLogged)
```

**具体实施**：

```javascript
// services/eventBus.js
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      this.listeners.set(event, listeners.filter(cb => cb !== callback));
    }
  }
}

export const eventBus = new EventBus();
```

> **不推荐 MobX / 重量级状态管理**：小程序 Page 有自己的生命周期和数据绑定，对 mobx 支持有限。大型项目可用 `mobx-miniprogram`，但本项目用 EventBus + Singleton Service 已足够。

### 7.2 数据层设计：轻量事件溯源

**核心决策：使用不可变只追加（append-only）事件日志作为 Source of Truth**

```
vs ┌──────────────────┐
状态快照方案           │  events = [
  storage: {           │    { id: 'evt_1', type: 'COMPLETE', ts: ..., taskId: '...' },
    pomosToday: 4,    │    { id: 'evt_2', type: 'BREAK', ts: ..., mode: 'short' },
    totalFocus: 100,  │    { id: 'evt_3', type: 'COMPLETE', ts: ..., taskId: '...' },
    ...               │  ]
  }                    │
                       │  优点：
  优点：读性能高       │  ✓ 可审计/可重播
  缺点：               │  ✓ 易于扩展新统计维度
  ✗ 不可审计          │  ✓ 时间旅行（回滚/撤销）
  ✗ 扩展统计困难      │  ✓ 与待办模块松耦合关联
  ✗ 数据不一致风险    │  ✓ 测试友好（纯函数）
                       │
                       │  缺点：读时聚合慢
                       │  对策：缓存每日快照
```

#### 事件类型定义

```javascript
// 标准事件类型
const EVENT_TYPES = {
  POMODORO_START: 'POMODORO_START',     // 开始专注
  POMODORO_COMPLETE: 'POMODORO_COMPLETE', // 专注完成（完整）
  POMODORO_ABANDON: 'POMODORO_ABANDON',  // 放弃（未完成）
  BREAK_START: 'BREAK_START',
  BREAK_COMPLETE: 'BREAK_COMPLETE',
  INTERRUPTION: 'INTERRUPTION',           // 打断记录
  TASK_LINKED: 'TASK_LINKED',            // 关联待办
};
```

#### 事件日志实现

```javascript
// services/eventLog.js
let events = wx.getStorageSync('pomoEvents') || [];

function logEvent(type, payload = {}) {
  const newEvent = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    type,
    timestamp: Date.now(),
    ...payload    // { mode, durationMs, taskId, notes }
  };

  events = [...events, newEvent];  // 不可变更新
  wx.setStorageSync('pomoEvents', events);

  eventBus.emit('eventLogged', newEvent);
  return newEvent;
}

// 纯函数：查询统计数据
function getStats(startTs, endTs) {
  return events
    .filter(e => e.timestamp >= startTs && e.timestamp <= endTs && e.type === 'POMODORO_COMPLETE')
    .reduce((stats, e) => {
      stats.count++;
      stats.totalDuration += e.durationMs || 0;
      if (e.taskId) {
        stats.byTask[e.taskId] = (stats.byTask[e.taskId] || 0) + 1;
      }
      return stats;
    }, { count: 0, totalDuration: 0, byTask: {} });
}
```

### 7.3 模块通信架构

```
  TimerService ──emit('sessionComplete')──▶ EventBus
       │                                        │
       │                                  ┌─────┴─────┐
       │                                  │           │
       ▼                                  ▼           ▼
  eventLog.logEvent()              TodosPage    StatsPage
  (持久化事件日志)                  (更新待办    (刷新统计)
                                   专注次数)     备注: 可选)

关键原则：
  • Timer 不知道谁在监听
  • Todos 不直接调用 Timer
  • Stats 从 EventLog 纯函数计算
  • 页面间只通过 EventBus + EventLog 通信
```

### 7.4 离线优先架构

微信小程序天然是离线优先的（纯客户端），但仍需：

```javascript
// services/storage.js — Storage 封装层
class StorageService {
  constructor(version = 2) {
    this.version = version;
    this._migrateIfNeeded();
  }

  get(key) {
    try {
      return wx.getStorageSync(key);
    } catch (e) {
      console.error(`Storage read error: ${key}`, e);
      return null;
    }
  }

  set(key, data) {
    try {
      wx.setStorageSync(key, data);
    } catch (e) {
      console.error(`Storage write error: ${key}`, e);
      // 存储满时提示用户清理
      if (e.errMsg?.includes('exceed')) {
        wx.showToast({ title: '存储空间不足，请清理旧记录', icon: 'none' });
      }
    }
  }

  _migrateIfNeeded() {
    const currentVersion = this.get('schema_version');
    if (currentVersion !== this.version) {
      // 执行数据迁移
      this._runMigration(currentVersion, this.version);
      this.set('schema_version', this.version);
    }
  }
}
```

> 如果未来需要云同步：事件日志天然可作为 CRDT 同步的基础（每条事件有唯一 ID + 时间戳，可做增量同步）。

### 7.5 不可变时间数据设计模式

#### 核心模式：所有时间状态从不可变时间戳推导

```javascript
// ✅ 正确：绝对时间戳驱动
const timerState = {
  startTs: Date.now(),          // 固定时间戳
  totalMs: 25 * 60 * 1000,     // 固定总时长
  pausedAccumulatedMs: 0,       // 已暂停累计
};

function calcRemaining(state, now = Date.now()) {
  const elapsed = now - state.startTs - state.pausedAccumulatedMs;
  return Math.max(0, state.totalMs - elapsed);
}

// ❌ 错误：可变计数器
let remainingSeconds = 1500;  // 灾难！后台无法恢复
```

#### 不可变更新模式

```javascript
// ✅ 正确：不可变更新
function updateTimerState(oldState, patch) {
  return Object.freeze({ ...oldState, ...patch });
}

// 事件日志只追加
function addEvent(events, newEvent) {
  return [...events, Object.freeze(newEvent)];
}

// ❌ 错误：直接 mutation
events.push(newEvent);         // ❌
timerState.remaining -= 1;     // ❌
```

---

## 8. 推荐架构总结

```
project/
├── app.js                        # 初始化 timer/eventBus/storage，处理生命周期
├── app.json
│
├── services/                     # 数据层（纯 JS，无页面依赖）
│   ├── timer.js                  # PomodoroTimer 类（Singleton）
│   ├── eventBus.js               # EventBus（PubSub 模式）
│   ├── eventLog.js               # 事件日志（不可变、只追加）
│   ├── storage.js                # Storage 封装（版本迁移/错误处理）
│   └── soundManager.js           # 音效管理
│
├── components/                   # 可复用组件
│   ├── circle-progress/          # Canvas 圆形进度组件
│   │   ├── index.wxml
│   │   ├── index.js
│   │   ├── index.wxss
│   │   └── index.json
│   └── interrupt-button/         # 「记录打断」按钮组件
│
├── pages/
│   ├── index/                    # 主番茄钟页（订阅 tick/stateChange）
│   ├── todos/                    # 待办（订阅 sessionComplete，关联任务）
│   ├── stats/                    # 统计（从 eventLog 纯函数计算）
│   ├── diary/                    # 日记（可选，与 event 关联）
│   └── settings/                 # 设置（时长/音效/振动/主题）
│
├── behaviors/                    # 共享 Behavior
│   └── timer-behavior.js         # 页面通用的定时器恢复逻辑
│
├── utils/
│   └── constants.js              # 冻结配置对象（WORK_MS, BREAK_MS 等）
│
└── assets/
    └── sounds/                   # 白噪音/提示音素材
```

### 关键决策点速查

| 决策 | 推荐方案 | 理由 |
|------|----------|------|
| 倒计时实现 | 绝对时间戳驱动 | 后台恢复无误差 |
| 进度动画 | Canvas | 灵活、可控、社区方案成熟 |
| 数据层 | 轻量事件溯源 | 可审计、可扩展时间统计 |
| 模块通信 | EventBus (PubSub) | 解耦、无直接依赖 |
| 状态管理 | Singleton Service + EventBus | 轻量、够用、不引入重量级框架 |
| 音效 | InnerAudioContext | 小程序原生、成本低 |
| 振动 | `wx.vibrateShort` 关键事件 | 电池友好、用户体验好 |

---

> **下一步**：阅读完本报告后，建议阅读 [待办模块调研报告](./todos-best-practices.md) 和 [统计模块调研报告](./stats-best-practices.md)，完成全部 4 个模块调研后再进入实现阶段。
