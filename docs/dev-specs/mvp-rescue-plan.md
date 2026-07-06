# MVP Rescue Plan — PM 总控与 worktree 并发方案

> 状态: 🚧 执行中  
> 日期: 2026-07-05  
> PM 结论: 当前分支是 MVP 集成草稿，不是严格 done。救援目标是契约冻结、并行修复、最终验收。

---

## 1. 背景

当前项目已有大部分前后端雏形：

- Login/Profile 已接 user API。
- Todo 已接 task CRUD。
- Focus 已能读取真实 task 并调用 `session/complete`。
- Stats 已调用 stats API。
- Diary 已调用 diary/task/stats API。

但不能标记 MVP done，主要问题：

1. **契约漂移**：Diary 前端字段与后端 canonical contract 不一致。
2. **假数据残留**：Stats 趋势图仍有 hardcoded arrays。
3. **字段错配**：heatmap/score 前端字段与后端返回不一致。
4. **导航漂移**：当前 app 是原生 tabBar，但旧文档仍描述 custom tab。
5. **Coach 未实现**：后端 route TODO，前端 mock。
6. **验收缺失**：缺少自动测试，需要明确 WeChat DevTools 手工 gate。

---

## 2. PM 决策

### 2.1 P0 范围

P0 只包含真实闭环：

```text
登录 → 待办 → 专注 session → 统计 → 日记 → 我的
```

| 模块 | P0 要求 |
|---|---|
| Login/User | 真实登录态、用户信息、设置读取 |
| Todo | 真实 CRUD，**FAB 按钮有可用交互** |
| Focus/Session | 选择真实任务，完成 session 写入 |
| Stats | 真实 today/weekly/monthly/heatmap 或诚实空态 |
| Diary | 真实 create/list，情绪写入 emotionTags |
| Profile | 真实 user info/settings |
| Coach | **升级为 P0**：基于规则引擎的评分 + 建议 + 真实周图表 |

### 2.2 P1 范围

| 模块 | 说明 |
|---|---|
| Coach 历史建议/成就徽章 | P0 只做 score + tip + 周图表；历史建议持久化和成就引擎为 P1 |
| 图片/语音日记 | P0 只保留占位 |
| 小时级趋势 | 后端未提供，不 fake |
| 月内每日趋势 | 后端未提供时不 fake |
| 日记详情页 | P1 |

### 2.3 契约策略

采用后端现有字段为 canonical，前端适配为主：

- Diary：`content/emotionTags/tasks` + `diaries/total/hasMore`
- Stats heatmap：`focusMinutes`
- Stats score：`aiScore`
- Navigation：原生 tabBar + `wx.switchTab`

---

## 3. Work packages

### WP0 — Contract / Docs Lead

**Worktree:** `mvp-contract-docs`

**目标：** 冻结规格，停止漂移。

**文件：**

- `docs/api-contracts.md`
- `docs/dev-specs/README.md`
- `docs/dev-specs/frontend-v2/README.md`
- `docs/dev-specs/frontend-v2/05-stats.md`
- `docs/dev-specs/frontend-v2/06-diary.md`
- `docs/dev-specs/mvp-rescue-plan.md`

**验收：**

- API contract 与 route/service 一致。
- Coach 明确 P1/mock。
- Diary/Stats spec 不再描述旧字段为主逻辑。

### WP1 — API Baseline / Mapper Convergence

**Worktree:** `mvp-api-baseline`

**目标：** 修正 API wrapper 和 mapper，供页面复用。

**文件：**

- `miniprogram/api/diary.api.js`
- `miniprogram/api/mappers.js`
- `miniprogram/api/request.js`（仅必要时）

**任务：**

- `diary.api.create` 改为 canonical `{ content, emotionTags, tasks }`。
- `mapDiaryToView` 主字段改为 `createdAt/emotionTags/content`。
- 兼容旧字段作为 fallback，但标注 deprecated。

### WP2 — Diary Quality

**Worktree:** `mvp-diary-quality`

**目标：** 日记创建/列表真实可用。

**文件：**

- `pages/diary/diary.js`
- 必要时 `pages/diary/diary.wxml`
- 必要时 `pages/diary/diary.wxss`

**任务：**

- `_loadEntries()` 读取 `res.data.diaries`。
- `onSave()` 发送 `content` + `emotionTags: [mapEmotionToCanonical(selectedEmotion)]`。
- 保存前把页面英文 emotion id 映射为后端中文枚举（如 `calm` → `平静`）。
- 保存后刷新列表。
- 已完成任务摘要使用 `taskAPI.list({ isDone: true }, 1, 20)`；严格“今日完成任务”筛选为 P1，需 Task 增加 `completedAt/doneAt` 或后端聚合。
- 今日统计使用 `statsAPI.today()`。

### WP3 — Stats Quality

**Worktree:** `mvp-stats-quality`

**目标：** 去 fake trend，字段对齐。

**文件：**

- `pages/stats/stats.js`
- 必要时 `pages/stats/stats.wxml`
- 必要时 `pages/stats/stats.wxss`

**任务：**

- 移除 hardcoded trend arrays。
- 周趋势使用 `weekly.dailyBreakdown`。
- heatmap 使用 `focusMinutes`。
- score 使用 `aiScore`。
- day/month unsupported trend 显示空态或禁用。

### WP4 — Navigation / Focus Polish

**Worktree:** `mvp-navigation-focus`

**目标：** 统一原生 tabBar，增强 Focus 失败态。

**文件：**

- `app.json`
- `pages/focus/focus.js`
- `pages/focus/focus.wxml`
- `pages/focus/focus.wxss`
- 少量页面导航 handler：`pages/stats/stats.js`, `pages/profile/profile.js`

**任务：**

- tab 页之间统一 `wx.switchTab`。
- 非 tab 页使用 `wx.navigateTo` / `wx.redirectTo`。
- 移除/隐藏重复 custom bottom tab。
- `session/complete` 失败时 showToast。

### WP5 — Login/Profile Hardening

**Worktree:** `mvp-login-profile-polish`

**目标：** 用户态更稳。

**文件：**

- `pages/login/login.js`
- `pages/profile/profile.js`
- `miniprogram/api/user.api.js`
- `miniprogram/api/auth.js`

**任务：**

- Profile load 失败有用户反馈。
- 404/401 清理登录态。
- 设置若不持久化，文档标 P1/local placeholder；若持久化，调用 `userAPI.updateSettings`。

### WP6 — Final QA / Release Gate

**Worktree:** `mvp-final-qa`

**目标：** 集成验证。

**任务：**

- 合并所有 worktree。
- 解决冲突。
- 微信 DevTools 编译。
- 跑 smoke test。
- 输出最终验收结论。

---

## 4. 并发策略

### 4.1 第一阶段

只启动：

```text
mvp-contract-docs
```

原因：所有实现必须先统一契约，否则并发越多返工越多。

### 4.2 第二阶段

契约冻结后先启动并尽快合并：

```text
mvp-api-baseline
```

API baseline 合并后，再并行启动：

```text
mvp-diary-quality
mvp-stats-quality
mvp-navigation-focus
mvp-login-profile-polish
```

说明：`mvp-diary-quality` 依赖 `diary.api.js` / `mapDiaryToView` 的 canonical wrapper/mapper，不能与 `mvp-api-baseline` 同时落地。Stats、Navigation、Login/Profile 可在契约冻结后提前侦查或准备草案，但正式合并应遵守下方顺序。

### 4.3 合并顺序

```text
1. mvp-contract-docs
2. mvp-api-baseline
3. mvp-diary-quality
4. mvp-stats-quality
5. mvp-navigation-focus
6. mvp-login-profile-polish
7. mvp-final-qa
```

如果 navigation 与 stats/profile 改同一文件，先合并 navigation，再让 stats/profile rebase。

---

## 5. 人手分配

### 最小配置：2 人

| 人员 | 任务 |
|---|---|
| Tech Lead / 全栈 | WP0 + WP1 + 合并把关 |
| 前端 | WP2 + WP3 + WP4 |

预计：2–3 天。

### 推荐配置：4 人

| 人员 | 任务 |
|---|---|
| PM / Tech Lead | WP0、范围控制、合并决策 |
| Frontend A | WP1 + WP2 Diary |
| Frontend B | WP3 Stats |
| Frontend C / QA | WP4 Navigation + WP6 验收 |

预计：1–1.5 天主要修复，0.5 天集成回归。

### 最大并发配置：5–6 人

| 人员 | 任务 |
|---|---|
| Contract Lead | WP0 |
| API/Mappers Engineer | WP1 |
| Diary Engineer | WP2 |
| Stats Engineer | WP3 |
| Navigation/Auth Engineer | WP4 + WP5 |
| QA/Release Captain | WP6 |

预计：0.5–1 天修复，0.5 天回归。

---

## 6. 质量门禁

### Gate A — Contract Gate

- [ ] `docs/api-contracts.md` 与 backend routes/services 一致。
- [ ] Diary 使用 `diaries` / `emotionTags`。
- [ ] Stats heatmap 使用 `focusMinutes`。
- [ ] Coach 标记 P1/mock。

### Gate B — Mock Gate

- [ ] 无 active `INITIAL_TASKS`。
- [ ] 无 active `TODAY_TASKS`。
- [ ] Stats 无 hardcoded trend arrays 作为真实数据。
- [ ] Diary history 不使用 mock。

### Gate C — Navigation Gate

- [ ] 原生 tabBar 页使用 `wx.switchTab`。
- [ ] 非 tab 页使用 `wx.navigateTo` / `wx.redirectTo`。
- [ ] 不出现双 tab。

### Gate D — Failure Handling Gate

- [ ] Login 失败恢复按钮状态并 toast。
- [ ] Todo 增删改查失败 toast。
- [ ] Focus session 记录失败 toast。
- [ ] Stats 加载失败 toast 且不显示 fake data。
- [ ] Diary 加载/保存失败 toast。
- [ ] Profile 用户态异常清理或提示。

### Gate E — Manual WeChat DevTools Gate

- [ ] 编译通过。
- [ ] 登录成功进入 Focus。
- [ ] 创建 Todo 后刷新仍存在。
- [ ] Focus 选择任务并完成 session。
- [ ] Stats 反映真实统计或空态。
- [ ] Diary 保存后列表出现并可刷新保留。
- [ ] Profile 显示用户信息/设置并可退出登录。

---

## 7. Smoke test 主链路

```text
1. 打开小程序 → 登录
2. 进入 Todo → 创建任务
3. 进入 Focus → 选择任务 → 完成一次番茄
4. 进入 Stats → 检查今日/周趋势/热力图
5. 进入 Diary → 写日记 + 选情绪 → 保存 → 刷新列表
6. 进入 Profile → 检查用户信息/设置 → 退出登录
```

---

## 8. Non-goals

以下内容不阻塞 P0：

- 真实 Coach 后端。
- AI 对话或复杂建议历史。
- 日记图片/语音上传。
- 小时级统计趋势。
- 月内每日趋势，除非新增后端字段。
- 自动化测试框架搭建。

---

## 9. 第二轮迭代（v2 · 2026-07-05 审计）

### 9.1 审计背景

首轮 MVP 救援（WP0-WP6）完成后进行现状审计，发现三个质量阻塞：

| # | 问题 | 严重度 | 说明 |
|---|---|---|---|
| 1 | Login 鉴权不合规 | **严重** | 需要 `wx.login()` → 后端 `jscode2session`；头像昵称必须通过 `chooseAvatar` + `type=nickname` 主动采集 |
| 2 | Todo FAB 无功能 | **高** | 右下角大蓝色加号按钮点击无反应，无聚焦/无滚动/无任务创建 |
| 3 | Coach 仍为 100% mock | **中** | 前端全硬编码、后端空桩；但所有依赖 repo 已就绪 |

### 9.2 新增 Work packages

#### WP7 — Login Fix

**Worktree:** `mvp-login-fix`

**主要文件:** `pages/login/login.js`

**关联 spec:** `docs/dev-specs/frontend-v2/07-login-fix.md`

**任务:**
- Login 页执行 `wx.login()` 并把 code 传给 `user/login`。
- 后端 `user/login` 使用 `WX_APP_SECRET` 调微信 `jscode2session`，不返回 `session_key`。
- Profile 页使用 `chooseAvatar` + `type=nickname` 主动采集头像昵称。
- 新增 `user/profile/update`，资料更新不再复用登录接口。

#### WP8 — Todo FAB Fix

**Worktree:** `mvp-todo-fab-fix`

**主要文件:** `pages/todo/todo.js`、`pages/todo/todo.wxml`

**关联 spec:** `docs/dev-specs/frontend-v2/08-todo-ux-fix.md`

**任务:**
- input 增加 `focus` 属性和 `bindblur`。
- `onFabTap` 改为 focus input + 重置 scrollTop。
- 创建成功后保持 inputFocus（连续添加）。

#### WP9 — Coach P0 实现

**Worktree:** `mvp-coach-p0`

**主要文件:**

| 层 | 文件 |
|---|---|
| 后端 | `cloudfunctions/focus-api/services/coach.service.js`（新建）|
| 后端 | `cloudfunctions/focus-api/routes/coach.routes.js`（重写）|
| 前端 | `miniprogram/api/coach.api.js`（新建）|
| 前端 | `pages/coach/coach.js` |

**关联 spec:** `docs/dev-specs/frontend-v2/09-coach-p0.md`

**任务:**
- 后端：基于规则引擎的 `getScore(openId)` + `getTip(openId)`。
- 前端：新建 `coach.api.js`；`coach.js` 接入真实 API + `stats/weekly`。
- P0 只做 score/tip + 周图表；成就/历史留 P1。

### 9.3 第二轮并发策略

WP7、WP8、WP9 可以**完全并行**，三者的改动文件无交集。

合并顺序：无所谓（无冲突风险）。

### 9.4 第二轮质量门禁

**Gate F — 新增**
- [ ] Login 使用 `wx.login` + 后端 `jscode2session`，且不返回 `session_key`。
- [ ] Profile 使用 `chooseAvatar` + `type=nickname` 主动采集头像昵称。
- [ ] 点击 Todo FAB 后输入框获得焦点、键盘弹出。
- [ ] `coach/score` + `coach/tip` 云函数可调通。
- [ ] Coach 页不再展示 hardcoded mock 数据。
- [ ] Coach 页用 `stats/weekly` 展示真实周趋势。
