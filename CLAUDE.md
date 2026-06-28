# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- Install dependencies: `npm install`
- Run the React/Figma prototype locally: `npm run dev`
- Build the React/Figma prototype: `npm run build`
- If `npm run dev` or `npm run build` reports `vite` is not found, run `npm install` first; this repository has a `package-lock.json`, but `node_modules` may be incomplete.
- Run the WeChat Mini Program: open the repository root in WeChat DevTools using `project.config.json`, then compile/preview from DevTools.
- After changing Mini Program npm dependencies such as `tdesign-miniprogram`, rebuild npm packages in WeChat DevTools so `miniprogram_npm/` matches `package.json` / `package-lock.json`.
- There is currently no configured lint or test script and no test framework in the project source, so there is no single-test command yet.

## Repository shape

This repository contains two related front-end targets for the same product, plus planning docs:

1. **WeChat Mini Program at the repository root** — this is the native Mini Program implementation opened by `project.config.json`.
2. **React/Vite Figma Make prototype** — source under `src/`, with a duplicated exported copy under `Figma/Designv1/`.
3. **Product and architecture docs** — under `docs/`, including the module plan and PRD.

Prefer editing the root Mini Program files when working on the native app. Prefer editing root `src/` when working on the React/Figma prototype. Treat `Figma/Designv1/` as a duplicated Figma export unless the task explicitly targets that folder.

## WeChat Mini Program architecture

- `app.json` registers the Mini Program entry page (`pages/focus/focus`), uses `navigationStyle: "custom"`, and declares TDesign Mini Program components globally (`t-button`, `t-icon`, `t-tab-bar`, etc.).
- `app.wxss` defines global design tokens and utility classes for the Mini Program, using `rpx`, WXSS variables, and shared colors such as `--primary`, `--bg`, `--text-primary`, and `--radius-*`.
- `pages/focus/focus.*` is the current native page implementation. `focus.js` owns timer state in `Page.data`, implements start/pause/reset/skip with `setInterval`, manages mode/sound/tab UI state, and sends simple feedback through WeChat APIs such as `wx.vibrateShort` and `wx.showToast`.
- `pages/focus/focus.wxml` composes the custom nav bar, `<circular-timer />`, sound chips, mode toggle, controls, summary cards, AI tip card, and TDesign tab bar. The tab bar currently updates local `activeTab` and shows a toast rather than navigating to separate pages.
- `components/circular-timer/*` is a custom Canvas 2D component. It receives `progress`, `mode`, `timeLeft`, and `state` as properties; observers redraw the ring and update formatted time/state labels.
- `miniprogram_npm/tdesign-miniprogram/` is generated/vendor output for WeChat npm components. Do not hand-edit it unless the task is specifically about vendored component output.
- `project.config.json` sets `miniprogramRoot` to `.`, `compileType` to `miniprogram`, `packNpmManually: true`, and the base library version to `3.7.12`.

## React/Figma prototype architecture

- `src/main.tsx` mounts `src/app/App.tsx` and imports `src/styles/index.css`.
- `src/app/App.tsx` is the central prototype shell: it renders a fixed-size phone frame, custom status/nav bars, a six-item tab bar, and owns tab selection. It also contains inline Focus, Todo, Profile, icon, helper, and mock-data logic.
- `src/app/components/StatsScreen.tsx`, `DiaryScreen.tsx`, and `AICoachScreen.tsx` are standalone prototype screens with local state and hard-coded/mock data.
- `src/app/components/ui/` contains shadcn/Radix-style generated UI primitives and `utils.ts` (`cn` combines `clsx` with `tailwind-merge`). Prefer app-specific changes in screens before modifying these primitives.
- `src/styles/index.css` imports `fonts.css`, `tailwind.css`, and `theme.css`. `theme.css` contains Tailwind v4 theme variables and app design tokens for the prototype.
- `vite.config.ts` uses React plus Tailwind v4 plugins, defines `@` as an alias to `src`, and includes a `figma:asset/...` resolver to map generated Figma asset imports into `src/assets`. Keep the React and Tailwind plugins because the config notes they are required for Figma Make.
- `postcss.config.mjs` is intentionally empty; Tailwind v4 is wired through `@tailwindcss/vite`, not PostCSS plugins.

## Product context from docs

- The product is a Pomodoro/focus-clock app for WeChat, aiming at a loop of **计划 → 执行 → 反思 → 优化** for students, exam preparation users, remote workers, and knowledge workers.
- `docs/basic/prd.md` is the concise current PRD. P0 scope includes focus timer with todo association, todo list, day/week/month statistics plus calendar heatmap, diary with emotion tags, and AI coach score/insight.
- `docs/module-plan-v1.md` expands the six-module plan: Pomodoro timer, todo list, statistics dashboard, diary reflection, AI coach, and goals/ranking.
- `docs/PRD.md` captures the interaction model for associating todos with Pomodoro sessions: select a task when starting focus; the timer screen displays the current task; completed Pomodoros increment the task count afterward.
- `docs/CHANGELOG-v1.3.0-architecture-upgrade.md` describes a Clean Layered Architecture (`pages/ → store/ → services/ → lib/`) and files such as `store/` and `services/`, but those directories are not present in the current tree. Verify the actual filesystem before relying on that changelog as implemented architecture.

## Styling and implementation notes

- UI copy is primarily Chinese; keep new user-facing copy consistent with the existing Chinese product language.
- Native Mini Program styles use WXSS/rpx and root tokens in `app.wxss`; React prototype styles use Tailwind utilities, inline styles, and CSS variables in `src/styles/theme.css`.
- Recharts is used in the React prototype statistics/coach screens. The native Mini Program currently does not include a charting layer in source.
- The root `package.json` covers both the Vite prototype dependencies and Mini Program npm dependency `tdesign-miniprogram`. `Figma/Designv1/package.json` is a standalone duplicate for the Figma export and does not include the native Mini Program files.


好，我来给你梳理整个项目的来龙去脉。

---

## Recent Session Context (2026-06-28)

> 以下是从最近一次开发会话中提取的关键上下文，供下一轮对话快速接手。

### ✅ 已完成的修复与新增

| 类别 | 内容 | 说明 | 涉及文件 |
|------|------|------|---------|
| 🐛 修复 | **计时器滚动** | `timer-section` 移出 `<scroll-view>`，外层用 `page-wrapper` (flex column, 100vh) 固定布局 | `focus.wxml`, `focus.wxss` |
| 🐛 修复 | **图标不显示** | `data:image/svg+xml` 替换为 TDesign `<t-icon>` 组件 | `focus.wxml`, `focus.js` |
| ✨ 新增 | **待办页面 (Todo)** | 完整复刻 Figma TodoScreen 设计，含 Quick Add + 筛选 + 任务 CRUD + 摘要栏 + FAB + 底部 Tab 导航 | `pages/todo/*` (4 files) |
| 🔗 联动 | **Tab 导航** | focus 页点击"待办"Tab → wx.redirectTo 跳转 todo 页；todo 页点击"专注"Tab → 跳回 focus 页 | `pages/focus/focus.js` |

### 📐 当前页面结构

**专注页 (pages/focus/focus.wxml)**:
```
page-wrapper (flex column, 100vh, overflow:hidden)
├── nav-shell (固定)
├── timer-section (固定，在 scroll-view 之外)
├── scroll-view (flex:1, height:0, 其余内容滚动)
└── bottom-tab-bar (自定义，用 t-icon)
```

**待办页 (pages/todo/todo.wxml)**:
```
page-wrapper (flex column, 100vh, overflow:hidden)
├── nav-shell (固定，自定义导航栏)
├── quick-add (固定，输入框 + 发送按钮)
├── filter-chips (固定，全部/进行中/已完成)
├── task-scroll (flex:1, 可滚动任务列表)
│   ├── (each task) checkbox + text + 🍅 + priority-dot + delete-btn
│   └── empty-state (无任务时显示)
├── summary-bar (固定，已完成 X/Y | 今日专注 XhYm)
├── fab-btn (固定，悬浮渐变按钮)
└── bottom-tab-bar (自定义，5个 Tab)
```

### 🔑 icon 映射表

| 控件 | 图标名 | TDesign 组件 |
|------|--------|-------------|
| 重置按钮 | `refresh` | `<t-icon name="refresh">` |
| 播放按钮 | `play-circle-stroke` | `<t-icon name="play-circle-stroke">` |
| 暂停按钮 | `pause-circle-stroke` | `<t-icon name="pause-circle-stroke">` |
| 跳过按钮 | `next` | `<t-icon name="next">` |
| Tab:专注 | `focus` | `<t-icon name="focus">` |
| Tab:待办 | `task` | `<t-icon name="task">` |
| Tab:统计 | `chart-bar` | `<t-icon name="chart-bar">` |
| Tab:日记 | `edit-1` | `<t-icon name="edit-1">` |
| Tab:我的/教练 | `user-avatar` | `<t-icon name="user-avatar">` |

### ⚠️ 已知注意事项

1. **DevTools 缓存问题**：通过 AI 外部修改文件后，DevTools 可能仍显示旧版本。解决：`工具 → 清除缓存 → 清除全部缓存 (Ctrl+Shift+Delete)`，再点击`编译` (Ctrl+B)
2. **JS 中不再有 SVG 生成函数**：`svgToDataUri()` 和 `createTabIcon()` 已被删除；`TAB_ITEMS` 的 `icon` 字段直接使用 t-icon 名称字符串
3. **t-icon 组件已全局注册**：`app.json` 的 `usingComponents` 中声明了 `"t-icon": "tdesign-miniprogram/icon/icon"`，页面无需重复注册
4. **scroll-view 约束**：`page-scroll` 必须同时有 `flex: 1` 和 `height: 0`，否则微信 scroll-view 高度计算异常
5. **组件路径**：TDesign 组件在 `miniprogram_npm/tdesign-miniprogram/` 下，勿手动编辑（npm 构建产物）
6. **WXML 不能使用函数调用**：如 `.trim()`、`Array.filter()` 等方法不能在 `{{ }}` 中使用；需通过 JS 预计算后 setData 传递
7. **CSS :hover 在移动端无效**：触摸设备无 hover 状态，删除按钮不使用 `:hover` 控制显隐，改为直接常显（低透明度）
8. **计算属性需手动同步**：微信 Page 不支持 ES6 getter 用于 WXML 数据绑定；`_updateComputed()` 方法在每次数据变更后手动调用
9. **wx.redirectTo 跳转**：Tab 切换使用 `wx.redirectTo` 而非 `wx.switchTab`（因未使用原生 tabBar），注意这会替换页面栈

### 📁 关键文件位置

| 文件 | 说明 |
|------|------|
| `pages/focus/focus.wxml` (134行) | 专注页页面结构，page-wrapper / timer-section / scroll-view / bottom-tab-bar |
| `pages/focus/focus.wxss` (383行) | 专注页样式，flex 布局定义 |
| `pages/focus/focus.js` (244行) | 计时器逻辑 + TAB_ITEMS 定义 |
| `components/circular-timer/*` | Canvas 2D 环形计时器组件 |
| `pages/todo/todo.wxml` (~110行) | 待办页页面结构，nav + 输入框 + 筛选 + 任务列表 + 摘要 + FAB + TabBar |
| `pages/todo/todo.wxss` (~330行) | 待办页样式，输入框/筛选/任务项/FAB 等 |
| `pages/todo/todo.js` (~190行) | 待办页逻辑，CRUD + 筛选 + 计算属性 |
| `docs/` | 产品文档 (PRD / 模块规划 / 架构) |
| `src/` | Figma Make 导出 → React/Vite 原型 |

### 🚧 后续可能的开发方向

- ✅ **待办页面 (Todo)** — 已完成，含 CRUD + 筛选 + 摘要
- 🔲 其他页面实现（统计/日记/我的/教练）
- 🔲 数据持久化（wx.setStorage）
- 🔲 音效选择功能完善
- 🔲 任务与番茄钟联动：开始专注时关联待办任务
- 🔲 AI 教练卡片交互（focus 页已有布局）
## 🗺️ 项目全景梳理

### 一、项目背景

这是一个**专注时钟（Pomodoro Timer）** 微信小程序项目，整个流程是：

```
Figma 设计稿
    ↓
Figma Make 导出 → src/ (React/Vite 原型)
    ↓
人工/Claude 翻译  → 微信小程序原生代码 (pages/ + components/)
```

### 二、Figma Make 相关文件

**Figma Make 是什么？** — 是 Figma 的"生成代码"功能，它把 Figma 设计稿导出成一个**可运行的 React/Vite Web 原型**，方便看交互效果和提取设计细节。

项目中 Figma Make 生成了两份（同一份内容）：

| 位置 | 用途 | 说明 |
|------|------|------|
| **`src/`** 🎯 **主源** | React/Vite 原型的主开发目录 | 这是真正的 Figma Make 产出，可直接 `npm run dev` 运行 |
| **`Figma/Designv1/`** 📦 | Figma Make 的导出备份 | 和 `src/` 内容完全一样，是 Figma 平台导出的快照副本，用作设计参考 |

**src/ 内部结构（Figma Make 产出）：**

```
src/
├── main.tsx                         # React 入口
├── app/App.tsx                      # 原型主文件（所有页面都在这个文件里）
├── app/components/
│   ├── AICoachScreen.tsx            # AI教练页
│   ├── DiaryScreen.tsx              # 日记页
│   ├── StatsScreen.tsx              # 统计页
│   └── figma/ImageWithFallback.tsx   # 图片降级组件
├── styles/
│   ├── theme.css                    # 设计 Tokens（色值/圆角/阴影等设计系统）
│   ├── globals.css                  # 全局样式
│   └── fonts.css                    # 字体定义
├── vite.config.ts                   # Vite 构建配置（React + Tailwind v4）
└── postcss.config.mjs               # PostCSS 配置
```

### 三、docs/ 文档体系

`docs/` 是我们的产品与架构文档库，按三级目录组织：

```
docs/
├── PRD.md                           # 【主PRD】产品需求文档（任务与番茄钟的交互模型）
├── CHANGELOG-v1.3.0-architecture-upgrade.md  # 架构升级方案
├── module-plan-v1.md                # 六大模块规划
│
├── basic/                           # 基础设计文档
│   ├── prd.md                       # 精简版 PRD（P0 范围）
│   ├── app-flow.md                  # 应用流程
│   ├── file-structure.md            # 文件结构约定
│   ├── frontend-guidelines.md       # 前端规范
│   ├── backend-structure.md         # 后端结构
│   └── tech-stack.md                # 技术栈选型
│
└── research/                        # 调研报告
    ├── pomodoro-best-practices.md   # 番茄工作法最佳实践
    ├── todo-list-best-practices.md  # 待办列表最佳实践
    └── statistics-dashboard-best-practices.md  # 统计面板最佳实践
```

### 四、微信小程序代码（根目录）

这是最终的目标产物 — **原生微信小程序**：

```
📄 app.json          # 小程序全局配置（注册页面 + TDesign 全局组件）
📄 app.js            # 入口
📄 app.wxss          # 全局样式（设计 Tokens + 工具类）
📄 project.config.json  # 项目配置（npm 构建、基础库版本）
📄 sitemap.json      # 搜索配置

📁 pages/focus/      # 🔥 专注页（核心页面）
   ├── focus.js      #   计时器逻辑（开始/暂停/重置/跳过）
   ├── focus.wxml    #   页面结构（导航栏→计时器→音效→模式→按钮→统计→AI教练→TabBar）
   ├── focus.wxss    #   页面样式
   └── focus.json    #   页面配置

📁 pages/todo/       # ✅ 待办页（已完成，可交互）
   ├── todo.js       #   任务 CRUD（增/删/改/筛选）
   ├── todo.wxml     #   页面结构（输入框→筛选→任务列表→摘要栏→FAB→TabBar）
   ├── todo.wxss     #   页面样式
   └── todo.json     #   页面配置

📁 components/circular-timer/  # 环形进度组件
   ├── circular-timer.js       # Canvas 2D 绘制
   ├── circular-timer.wxml     # Canvas + 文字叠加
   ├── circular-timer.wxss     # 样式
   └── circular-timer.json     # 组件声明

📁 miniprogram_npm/tdesign-miniprogram/  # TDesign 组件（npm 构建产物，勿手动编辑）
```

### 五、关系总结

```
Figma 设计软件
  └─(Figma Make 导出)─→  src/ (React/Vite 原型)
                          │
                          │ 提供：设计视觉参考、交互逻辑、设计 Tokens
                          ▼
                pages/focus/* + pages/todo/*  (微信小程序原生实现)
                          │
                          ├─UI 组件库：TDesign Miniprogram
                          ├─Canvas 绘制：circular-timer 组件
                          ├─Todo 逻辑：Page Data + _updateComputed
                          └─Tab 切换：wx.redirectTo 多页面架构
```

---
