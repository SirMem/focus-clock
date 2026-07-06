# Frontend Integration v2 — 前端真实 API 闭环救援规划

> 状态: 🚧 MVP 救援执行中
> 角色: PM / Tech Lead 总控文档
> 契约来源: [`../api-contracts.md`](../../api-contracts.md)
> 总执行计划: [`../mvp-rescue-plan.md`](../mvp-rescue-plan.md)

---

## 0. 当前判断

当前分支不是“未开始”，而是“集成草稿接近完成但契约漂移”。因此 v2 不再按绿地顺序从 01 到 06 全部重写，而是按质量救援优先级执行。

已基本完成：

- API foundation：`request.js` / `auth.js` / `mappers.js` / `stats.api.js` 已存在。
- Login/Profile：已接 `userAPI` 和本地登录态。
- Todo：已接 `taskAPI` CRUD。
- Focus：已接真实 task 选择和 `session/complete`。

主要阻塞：

- Diary 契约漂移：前端旧字段 `title/mood/tags/entries` vs 后端 canonical `content/emotionTags/tasks/diaries`。
- Stats 假数据残留：趋势图仍有 hardcoded arrays；heatmap/score 字段不匹配。
- 导航文档漂移：当前 `app.json` 是原生 tabBar，但旧文档仍描述 custom tab + `redirectTo`。
- Coach 仍是 mock/TODO，不计入 P0。

---

## 1. P0 闭环目标

```text
登录 → 获取用户身份
  ↓
创建待办 → 云数据库持久化
  ↓
选择任务开始专注 → 完成 session → 更新 daily_summaries + task 进度
  ↓
统计页读取真实统计或诚实空态
  ↓
日记页保存/读取真实日记，并展示今日完成任务摘要
  ↓
我的页读取用户信息/设置
```

P0 模块：

| 模块 | P0 状态目标 |
|---|---|
| Login/User | 真实登录态、真实用户信息 |
| Todo | 真实 CRUD |
| Focus/Session | 真实任务选择 + session 写入 |
| Stats | 真实 today/weekly/monthly/heatmap；无 fake trend |
| Diary | 真实 create/list；情绪写入 `emotionTags` |
| Profile | 真实 user info/settings |

P1 模块：

| 模块 | 说明 |
|---|---|
| Coach | 后端路由当前 TODO，前端 mock；不计入 P0 done |
| 图片/语音日记 | P0 保留 toast/占位，不做真实能力 |
| 小时级趋势 | 后端未提供，不在 P0 fake |
| 月内每日趋势 | 后端未提供时不在 P0 fake |

---

## 2. 当前架构约束

### 2.1 API 调用

页面必须通过 `miniprogram/api/*.api.js` 调用云函数：

```text
miniprogram/api/
├── request.js       # callAPI(url, data, options)
├── auth.js          # 登录态读写
├── mappers.js       # 后端字段 → 页面字段
├── task.api.js      # task/create/list/update/delete
├── session.api.js   # session/complete/list
├── stats.api.js     # stats/today/weekly/monthly/heatmap
├── diary.api.js     # diary/create/list/update/delete
└── user.api.js      # user/login/info/settings
```

禁止页面直接散落 `wx.cloud.callFunction({ name: 'focus-api' })`。

### 2.2 字段转换

后端字段到页面字段必须集中在 `miniprogram/api/mappers.js`。

重点 mapper：

- `mapTaskToView(task)`：`_id/title/isDone/...` → `id/text/done/...`
- `mapDiaryToView(entry)`：`createdAt/emotionTags/content` → `date/emotion/preview/title`
- `formatDuration(minutes)`：统计时间展示

### 2.3 导航

当前采用 `app.json` 原生 tabBar：

```text
pages/focus/focus
pages/todo/todo
pages/stats/stats
pages/diary/diary
pages/profile/profile
```

规则：

- tab 页之间使用 `wx.switchTab`。
- 非 tab 页使用 `wx.navigateTo` 或 `wx.redirectTo`。
- 页面内 custom bottom tab 若与原生 tabBar 重复，应移除/隐藏或明确降级。

---

## 3. 当前执行顺序

### 阶段 1：契约冻结（单 worktree）

| Worktree | 内容 | 文件 |
|---|---|---|
| `mvp-contract-docs` | 统一 API contract、修正 specs、明确 P0/P1 | `docs/api-contracts.md`, `docs/dev-specs/**` |

### 阶段 2：基础适配（单 worktree，尽快合并）

| Worktree | 内容 | 文件 |
|---|---|---|
| `mvp-api-baseline` | 修正 diary API wrapper 和 mapper | `miniprogram/api/diary.api.js`, `miniprogram/api/mappers.js` |

### 阶段 3：页面修复（可并行）

| Worktree | 内容 | 依赖 |
|---|---|---|
| `mvp-diary-quality` | Diary 真实 create/list/情绪 | contract + api baseline |
| `mvp-stats-quality` | Stats 去 fake trend、字段对齐 | contract |
| `mvp-navigation-focus` | 原生 tabBar、Focus 失败态 polish | contract |
| `mvp-login-profile-polish` | 登录/我的失败态 hardening | contract |

### 阶段 4：集成验收（串行）

| Worktree | 内容 |
|---|---|
| `mvp-final-qa` | 合并、冲突处理、WeChat DevTools smoke test |

---

## 4. Spec 文件状态

| 文件 | 当前用途 | 状态 |
|---|---|---|
| `01-api-foundation.md` | API 基础设施 | ✅ 基本完成，按需 hardening |
| `02-login-profile.md` | 登录/Profile | ✅ 已升级：`wx.login` 鉴权 + Profile 主动采集头像昵称 |
| `03-todo.md` | Todo CRUD | ✅ 线上版本完成，🚧 第二轮修复 FAB UX |
| `04-focus-session.md` | Focus + Session | ✅ 已完成 |
| `05-stats.md` | Stats 真实化 | ✅ 已完成 |
| `06-diary.md` | Diary 真实化 | ✅ 已完成 |
| `07-login-fix.md` | Login 基础库 3.7.12 适配 | 🚧 新增，待执行 |
| `08-todo-ux-fix.md` | Todo FAB 功能修复 | 🚧 新增，待执行 |
| `09-coach-p0.md` | Coach P0 实现 | 🚧 新增，待执行 |

---

## 5. 全局验收清单

- [ ] API contract 与 route/service 实现一致。
- [ ] Diary 不再以 `entries` 为主字段。
- [ ] Diary 创建发送 `content/emotionTags/tasks`。
- [ ] Stats trend 不使用 hardcoded arrays 冒充真实数据。
- [ ] Heatmap 主字段为 `focusMinutes`。
- [ ] Score 主字段为 `aiScore` 或空态。
- [ ] 原生 tabBar 导航一致，无双 tab。
- [ ] API 失败路径有 toast 或明确状态。
- [ ] WeChat DevTools 编译通过。
- [ ] 主链路 smoke test 通过。

---

## 6. Review 策略

每个 worktree 完成后检查：

1. 是否只修改该 worktree 文件范围。
2. 是否符合 `docs/api-contracts.md`。
3. 是否新增 fake real-data mock。
4. 是否把字段转换集中在 `mappers.js`。
5. 是否破坏原生 tabBar 导航。
6. 是否有用户可见失败反馈。
