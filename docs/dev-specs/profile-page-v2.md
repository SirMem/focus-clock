# Profile 个人页 v2 — 单页切换 + 6 个子页面

## Problem Statement

当前「我的」页（`pages/profile/profile.*`）已实现用户资料卡和菜单布局，但存在两个严重问题：

1. **数据空洞**：统计摘要行（`summaryStats`）和本月目标卡片（`monthlyGoalProgress` 等 4 个字段）在 WXML 中渲染但 JS 从未定义或加载，导致页面区块空白。
2. **子页面缺失**：Figma 设计稿包含 6 个可交互子页面（个人目标/成就勋章/主题设置/数据导出/帮助与反馈/关于），当前全部是 Toast 空壳。

用户以「我的」页为入口管理个人资料、计时偏好、成就和数据，这些缺失直接影响了核心用户体验的完整性。

## Solution

将 `pages/profile/profile.*` 改造为 **单页内视图切换** 架构：主页面通过 `currentView` 状态控制渲染哪个子视图，每个子视图通过 WXML `block wx:if` 切换，JS 维护子视图状态。子视图使用统一的返回按钮导航回主视图。

该方案的优势：
- 与 Figma 设计意图一致（视图切换带返回动画感）
- 用户设置（目标/主题/通知等）在同一页面内共享状态，无需跨页面传递
- 避免微信小程序页面栈膨胀（`wx.navigateTo` 栈有 10 层限制）

---

## User Stories

1. As a 用户, I want to 在「我的」页面看到统计摘要（累计专注/连续打卡/获得勋章）, so that 我可以快速了解自己的整体情况
2. As a 用户, I want to 在「我的」页面看到本月目标进度条和剩余时间, so that 我可以追踪月度目标的完成情况
3. As a 用户, I want to 在「我的」页面点击功能菜单项进入对应的子页面, so that 我可以管理个人目标和查看成就
4. As a 用户, I want to 在「我的」页面切换通知/音效/振动开关, so that 我可以控制计时器的提醒偏好
5. As a 用户, I want to 在子页面中点击返回按钮回到主视图, so that 我可以继续浏览其他菜单项
6. As a 用户, I want to 在「个人目标」子页面设置单次专注时长, so that 我可以自定义番茄钟的长度
7. As a 用户, I want to 在「个人目标」子页面设置月度专注小时目标, so that 我可以规划每月的专注工作量
8. As a 用户, I want to 在「个人目标」子页面设置每日番茄目标, so that 我可以设定每天的完成量
9. As a 用户, I want to 在「个人目标」子页面看到本月目标进度, so that 我可以了解当前进度与目标的差距
10. As a 用户, I want to 在「个人目标」子页面保存设置后看到确认反馈, so that 我知道设置已生效
11. As a 用户, I want to 在「成就勋章」子页面看到已解锁和未解锁勋章的总览摘要, so that 我可以了解自己的勋章收集进度
12. As a 用户, I want to 在「成就勋章」子页面切换「全部/已获得/未解锁」筛选, so that 我可以按状态浏览勋章
13. As a 用户, I want to 在「成就勋章」子页面看到未解锁勋章的进度百分比, so that 我知道还差多少达成条件
14. As a 用户, I want to 在「主题设置」子页面切换浅色/深色/跟随系统模式, so that 我可以选择偏好的视觉风格
15. As a 用户, I want to 在「主题设置」子页面选择主题色, so that 我可以个性化 App 的主色调
16. As a 用户, I want to 在「主题设置」子页面调整文字大小, so that 我可以获得更好的阅读体验
17. As a 用户, I want to 在「数据导出」子页面看到数据概览（专注记录数/日记条目/任务记录）, so that 我了解可导出的数据量
18. As a 用户, I want to 在「数据导出」子页面选择导出范围（最近 7 天/30 天/全部）, so that 我可以控制导出数据的范围
19. As a 用户, I want to 在「数据导出」子页面选择导出格式（CSV/JSON/PDF）, so that 我可以选择适合我使用的格式
20. As a 用户, I want to 在「帮助与反馈」子页面查看常见问题解答, so that 我可以自助解决常见疑问
21. As a 用户, I want to 在「帮助与反馈」子页面提交意见反馈, so that 我可以向开发者反映问题或建议
22. As a 用户, I want to 在「关于」子页面看到应用版本信息和开发团队, so that 我可以了解 App 的基本信息
23. As a 用户, I want to 在「关于」子页面为 App 评分, so that 我可以表达对产品的满意度
24. As a 用户, I want to 在「关于」子页面查看用户协议和隐私政策, so that 我可以了解法律条款

---

## Implementation Decisions

### 1. 架构：单页内视图切换

```
pages/profile/
├── profile.js        ← 主逻辑，currentView 控制子视图
├── profile.wxml      ← 7 个 block wx:if 对应主视图 + 6 个子视图
├── profile.wxss      ← 所有子视图样式
└── profile.json      ← navigationStyle: custom（不变）
```

**视图切换模型**：
- `currentView` 取值: `'main' | 'goal' | 'achievements' | 'theme' | 'export' | 'help' | 'about'`
- 默认 `'main'`
- 每个子视图是一个 `<block wx:if="{{currentView === 'goal'}}">` 包裹的完整视图片段
- 返回按钮统一设置 `currentView` 为 `'main'`
- 切换时不保留子视图的滚动位置（自然滚动到顶部）

**为什么不使用组件或 template**:
- 微信小程序自定义组件在同一个 `Page` 内通信复杂（需要 triggerEvent + 属性传递）
- WXML `<template>` 无法独立管理自身 data
- 用 `block wx:if` + 在 Page data 内维护各子视图状态是最简单可靠的方式，与现有代码风格一致

### 2. 导航栏设计

所有子视图共享导航栏结构（与主视图不同的导航栏内容）：
- 主视图：标题"我的"，右侧 more 图标
- 子视图：左侧返回图标，中间标题（如"个人目标"），右侧空白
- 导航栏统一由 profile.wxml 的 nav-shell 根据 `currentView` 条件渲染

### 3. 数据加载策略

**主视图（MainView）** — 每次 `onShow` 时重新加载：
- `statsAPI.monthly()` — 获取月度统计用于目标进度和摘要
- `statsAPI.weekly()` — 获取周统计（目前 coach 页已实现类似模式）
- `userAPI.getSettings()` — 获取本地设置
- **注意**：`summaryStats` 和 `monthlyGoal*` 字段必须在数据加载成功后 `setData`，并设默认兜底值

**子视图数据**：
- **个人目标页**：数据从 `userAPI.getSettings()` 获取 `focusDuration`/`dailyGoal`，月度目标进度从 `statsAPI.monthly()` 获取。保存时调用 `userAPI.updateSettings()`。
- **成就勋章页**：暂无后端 API，先使用 **本地静态数据**（12 个勋章定义），按 `coachAPI.score()` 返回的 `insights` 匹配已解锁状态
- **主题设置页**：设置仅存本地 `wx.setStorageSync`（主题色 + 深浅模式 + 字号），无后端接口
- **数据导出页**：数据概览数字从 `statsAPI.today()` / `diaryAPI.list()` 获取，导出功能先用 `wx.showToast` 示意（真实导出为 P2）
- **帮助与反馈页**：FAQ 使用本地静态数据；反馈表单调用现有 `diaryAPI.create()` 或新 `userAPI.submitFeedback()`（P1 新增）
- **关于页**：全部静态数据

### 4. 视图滚动行为

Figma 设计稿中每个子视图都是独立滚动区域（`overflow-y: auto`）。每个子视图的容器使用 `flex: 1; overflow-y: auto` 实现独立滚动，不依赖外层 scroll-view。当前主视图使用 `<scroll-view>`，改造后将主视图内容也放入可滚动容器，确保大屏设备上内容可滚动。

### 5. 通知/音效/振动开关

Figma 设计稿有 3 个 toggle：
- 消息通知（`notifications` bool）
- 音效（`sound` bool）
- 振动（`vibration` bool）← **当前实现缺失，需新增**

开关状态持久化到 `userAPI.updateSettings()`，因为 UserRepo 的 settings 字段白名单允许扩展。初次实现时先存本地 storage，等后端白名单扩展后再对接 API。

### 6. 成就勋章数据模型（本地静态）

从 Figma 设计稿提取的勋章定义（共 12 个）：

```javascript
const ACHIEVEMENTS = [
  { id: 1, icon: "🔥", name: "坚持达人", desc: "连续专注 7 天", earned: true, date: "6月21日" },
  { id: 2, icon: "⭐", name: "番茄收割机", desc: "累计完成 50 个番茄", earned: true, date: "6月18日" },
  { id: 3, icon: "🧘", name: "心流状态", desc: "单日完成 10 个番茄", earned: true, date: "6月17日" },
  { id: 4, icon: "📚", name: "学习狂人", desc: "学习类任务累计 20h", earned: true, date: "6月10日" },
  { id: 5, icon: "🌅", name: "晨型人", desc: "连续 5 天 8 点前开始", earned: true, date: "6月5日" },
  { id: 6, icon: "🏅", name: "月度冠军", desc: "单月专注超过 40h", earned: true, date: "5月31日" },
  { id: 7, icon: "💎", name: "钻石专注", desc: "累计专注 200h", earned: false, progress: 64 },
  { id: 8, icon: "🚀", name: "百日打卡", desc: "连续专注 100 天", earned: false, progress: 15 },
  { id: 9, icon: "🎯", name: "目标猎人", desc: "连续 3 月达成目标", earned: false, progress: 33 },
  { id: 10, icon: "🌙", name: "夜枭专注", desc: "21 点后完成 5 个番茄", earned: false, progress: 60 },
  { id: 11, icon: "⚡", name: "闪电模式", desc: "单次专注不中断 2h", earned: false, progress: 0 },
  { id: 12, icon: "🌍", name: "全球同步", desc: "与 100 人同时专注", earned: false, progress: 0 },
];
```

当前 P0 阶段使用 **静态数据**，`earned` 状态由 `coachAPI.score()` 返回的 `insights` 驱动。后续 P1 可升级为后端数据库存储。

### 7. 主题设置实现方案

主题设置包含两部分，差异化处理：

| 设置项 | 实现方案 | 持久化 |
|--------|----------|--------|
| 浅色/深色/跟随系统 | 切换 `app.wxss` 中的 CSS 变量 | `wx.setStorageSync('theme_mode', ...)` |
| 主题色 | 切换 `--primary` 等 CSS 变量 | `wx.setStorageSync('theme_accent', ...)` |
| 文字大小 | 切换根字号 scale | `wx.setStorageSync('theme_fontsize', ...)` |

P0 版本仅做 UI 切换 + 本地存储。CSS 变量切换需修改 `app.wxss` 使用 `var(--primary)` 引用已定义的设计 token。

### 8. API 扩展（后端变更清单）

| 变更 | 说明 | 优先级 |
|------|------|--------|
| `user/settings/update` 白名单扩展 | 新增 `notificationEnabled` / `soundEnabled` / `vibrationEnabled` 字段 | P0 |
| `coach/achievements` 新接口 | 返回用户成就列表（静态数据 + 进度） | P0 if time, else P1 |
| `user/feedback` 新接口 | 提交用户反馈文本 | P1 |

---

## Testing Decisions

本项目无测试框架，但将用 **BDD 场景描述** 作为验收标准。每个场景描述一个用户可观测的行为，开发者在实现后逐条验证。

### BDD 场景

**Feature: Profile 主视图**

```
Scenario: 未登录用户看到引导状态
  Given 用户未登录
  When 进入「我的」页面
  Then 显示「点击登录」提示
  And 显示「登录后查看完整数据」
  And 统计摘要和本月目标区域显示占位内容

Scenario: 已登录用户看到真实数据
  Given 用户已登录
  And 后端有月度统计数据
  When 进入「我的」页面
  Then 统计摘要行显示「累计专注」「连续打卡」「获得勋章」
  And 本月目标卡片显示进度条和剩余时间

Scenario: 切换通知开关
  Given 用户已登录
  When 在设置区域点击「消息通知」开关
  Then 开关状态切换
  And 状态写入本地存储
```

**Feature: 子视图导航**

```
Scenario: 从主视图进入个人目标
  Given 用户在「我的」主页面
  When 点击功能菜单的「个人目标」
  Then 页面切换到个人目标子视图
  And 导航栏显示返回按钮和标题「个人目标」

Scenario: 从子视图返回主视图
  Given 用户在个人目标子视图
  When 点击返回按钮
  Then 页面切换回主视图
  And 导航栏恢复为标题「我的」
```

**Feature: 个人目标设置**

```
Scenario: 调整单次专注时长
  Given 用户在个人目标子视图
  And 当前专注时长为 25 分钟
  When 点击 30 分钟按钮
  Then 选中的按钮高亮为蓝色
  And 底部提示更新为「30 分钟 / 个番茄」

Scenario: 调整月度目标
  Given 用户在个人目标子视图
  And 当前月目标为 50 小时
  When 点击 + 按钮
  Then 数字增加为 55 小时
  When 点击快速选择 80h
  Then 数字跳转为 80 小时

Scenario: 保存目标设置
  Given 用户在个人目标子视图
  And 已调整至少一项设置
  When 点击「保存设置」
  Then 按钮变为「✓ 目标已保存」绿色状态
  And 设置写入后端 userAPI.updateSettings()
```

**Feature: 成就勋章**

```
Scenario: 浏览全部勋章
  Given 用户在成就勋章子视图
  Then 顶部摘要栏显示已解锁数量（如 6/12）
  And 默认显示「全部」筛选
  And 网格中显示所有 12 个勋章
  And 已解锁勋章彩色显示，未解锁勋章灰色+🔒

Scenario: 筛选已获得勋章
  Given 用户在成就勋章子视图
  When 点击「已获得」筛选标签
  Then 只显示已解锁的勋章
  And 筛选标签高亮

Scenario: 查看未解锁勋章进度
  Given 用户在成就勋章子视图
  When 选择「未解锁」筛选
  Then 每个勋章下方显示进度条和百分比
```

**Feature: 主题设置**

```
Scenario: 切换显示模式
  Given 用户在主题设置子视图
  When 点击「深色」模式预览卡
  Then 深色卡片边框高亮为主题色
  And 底部显示「深色」标签
  And 保存后可全局应用
```

**Feature: 数据导出**

```
Scenario: 查看数据概览
  Given 用户在数据导出子视图
  Then 显示专注记录数/日记条目/任务记录 3 个统计

Scenario: 选择导出选项
  Given 用户在数据导出子视图
  When 选择「最近 30 天」
  And 选择「CSV 表格」
  And 点击「导出 CSV 文件」
  Then 按钮显示「导出中...」loading 状态
  Then 按钮变为绿色「✓ 导出成功」
```

**Feature: 帮助与反馈**

```
Scenario: 查看常见问题
  Given 用户在帮助与反馈子视图
  Then 显示使用指南/视频教程/在线客服 3 个快捷入口
  And 显示常见问题列表
  When 点击一个问题
  Then 答案展开显示
  When 再次点击
  Then 答案收起

Scenario: 提交反馈
  Given 用户在帮助与反馈子视图
  When 在输入框中填写反馈内容
  And 点击「提交反馈」
  Then 按钮变为「✓ 反馈已提交」
  And 输入框清空
```

**Feature: 关于页**

```
Scenario: 查看应用信息
  Given 用户在关于子视图
  Then 显示应用图标和名称「专注时钟」
  And 显示版本号 v2.1.0
  And 显示开发团队等信息

Scenario: 给应用评分
  Given 用户在关于子视图
  When 点击第 4 颗星
  Then 前 4 颗星高亮
  When 点击「提交评分」
  Then 评分卡变为感谢状态
```

### 测试方法

由于无测试框架，验收方式为：
1. 开发者在微信 DevTools 中逐条运行 BDD 场景
2. 使用 `console.log` 验证数据加载和状态流转
3. 视觉验证与 Figma 设计稿截图对比

---

## Out of Scope

- **真实主题色全局切换**（CSS 变量系统设计）— 需在 app.wxss 层面建立完整的主题 token 系统，本 spec 只做 UI 选择 + 存储，实际全局应用为独立任务
- **真实数据导出功能**— 本 spec 只实现 UI 选择和导出流程示意（Toast），后端导出逻辑为 P2
- **成就勋章后端持久化**— 本 spec 使用本地静态数据 + `coachAPI.score()` 驱动
- **在线客服集成**— 帮助页的「在线客服」按钮保持 Toast 示意
- **用户协议/隐私政策页面**— 保持 Toast 示意，真实页面为 P2
- **多语言/国际化**— 全部以中文呈现

## Further Notes

- 本 spec 的 BDD 场景是验收清单而非自动化测试，开发者完成实现后逐条标记通过
- profile.js 预计从 ~240 行增长到 ~600-800 行（7 个视图的 data + 逻辑），是合理的单文件复杂度
- Figma 设计稿参考：`Figma/src/app/components/ProfileScreen.tsx`（Figma Make 导出，1062 行完整参考实现）
- 子视图的交互细节（焦点、动画、过渡）全部以 Figma 导出为准
- 用户设置的 API 白名单扩展由本 spec 依赖的后端变更覆盖，需同步推进
