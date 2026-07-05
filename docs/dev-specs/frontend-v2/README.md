# Frontend Integration v2 — 前端真实 API 闭环对接规划

> 状态: 🔲 待执行  
> 角色: 项目经理 / 架构师规划文档  
> 执行对象: 无上下文 Claude Code 窗口  
> 旧版: `docs/archive/specs/superseded/05-frontend-v1.md` 已废弃，原因是只做到“调用 API”，没有完成产品闭环。

---

## 0. 为什么要做 v2

当前页面存在的问题：

1. **登录页仍然接近 mock 流程**：只是固定传 `微信用户`，没有获取用户资料，也没有统一登录态守卫。
2. **focus-api 未被完整使用**：统计页未调用 `stats/*`，专注页没有真正联动 Task 选择与 Session 写入。
3. **页面之间没有数据刷新协议**：Todo 创建/完成后，Focus/Stats/Diary 不知道数据变化。
4. **API 调用没有统一兜底**：401、网络失败、加载态、空状态各页面自己散写。

v2 的目标不是“看起来连上接口”，而是让 MVP 形成真实闭环：

```
登录 → 获取用户身份
  ↓
创建待办 → 云数据库持久化
  ↓
选择任务开始专注 → 完成 session → 更新 daily_summaries + task 进度
  ↓
统计页读取真实统计
  ↓
日记页读取真实日记，并展示今日完成任务摘要
  ↓
我的页读取用户信息/设置
```

---

## 1. 当前后端能力

已有 API 封装：

```
miniprogram/api/
├── request.js       # callAPI(url, data)
├── task.api.js      # create/list/update/delete
├── session.api.js   # complete/list
├── diary.api.js     # create/list/get/update/delete
└── user.api.js      # login/getInfo/getSettings/updateSettings
```

已有后端路由：

```
focus-api:
├── user/login, user/info, user/settings/get, user/settings/update
├── task/create, task/list, task/update, task/delete
├── session/complete, session/list
├── stats/today, stats/weekly, stats/monthly, stats/heatmap
└── diary/create, diary/list, diary/get, diary/update, diary/delete
```

---

## 2. 执行顺序（非常重要）

不能一次性让多个窗口同时改页面。正确顺序：

### 第 1 轮：基础设施（必须先做，单窗口）

| 顺序 | Spec | 内容 | 是否可并行 |
|------|------|------|-----------|
| 1 | `01-api-foundation.md` | 完善 API 封装、登录态工具、数据映射工具 | ❌ 必须先做 |

### 第 2 轮：独立页面对接（可并行）

| 顺序 | Spec | 内容 | 依赖 |
|------|------|------|------|
| 2A | `02-login-profile.md` | 登录页 + 我的页真实用户信息/设置 | 01 |
| 2B | `03-todo.md` | Todo 页真实 CRUD + 本地页面格式映射 | 01 |

这两个可以并行，因为一个改 `login/profile`，一个改 `todo`。

### 第 3 轮：业务闭环（串行）

| 顺序 | Spec | 内容 | 依赖 |
|------|------|------|------|
| 3 | `04-focus-session.md` | Focus 页选择任务 + 完成 session + 更新统计 | 02-login-profile + 03-todo |

必须等 Todo 完成，因为 Focus 需要选择真实 Task。

### 第 4 轮：展示层（可并行）

| 顺序 | Spec | 内容 | 依赖 |
|------|------|------|------|
| 4A | `05-stats.md` | Stats 页读取 stats/today weekly monthly heatmap | 04 |
| 4B | `06-diary.md` | Diary 页真实日记 + 今日任务摘要 | 03-todo + 04 |

Stats 和 Diary 可并行，因为都只读数据。

---

## 3. 并行执行图

```text
01-api-foundation
        │
        ├──────────────┬──────────────┐
        ▼              ▼              │
02-login-profile   03-todo            │
        │              │              │
        └──────┬───────┘              │
               ▼                      │
        04-focus-session               │
               │                      │
        ┌──────┴───────┐              │
        ▼              ▼              │
   05-stats       06-diary             │
```

---

## 4. 全局约束

所有执行窗口必须遵守：

- 工作目录：`F:\Design WeChat Mini Program`
- 只修改 spec 指定文件，不要顺手重构其他文件。
- 不修改 `cloudfunctions/` 后端文件。
- 不修改 `app.json` 页面列表，除非 spec 明确要求。
- 不修改 `*.wxml` / `*.wxss`，除非 spec 明确要求。
- 不删除 mock 常量，除非该 spec 明确要求删除。
- 所有 API 调用必须处理：loading、失败 toast、401 登录失效。
- 页面数据结构必须通过 mapper 转换，禁止把后端字段直接散落在 WXML 绑定里。

---

## 5. 完成标准

v2 完成后：

- 登录页使用真实用户资料或明确降级为匿名微信用户；登录成功写入本地登录态。
- Todo 页刷新不丢数据，增删改查全走云数据库。
- Focus 页可以从真实任务中选择当前任务，并完成 session 写入。
- Stats 页展示真实 `daily_summaries` 数据。
- Diary 页保存/读取真实日记，并展示今日专注任务摘要。
- Profile 页展示真实用户信息和设置。

---

## 6. Review 策略

每个窗口完成后，由主窗口执行：

1. `git diff -- <spec指定文件>` 检查是否越界改文件。
2. grep 页面中是否还存在应删除的 mock 常量。
3. 检查 API import 路径是否统一。
4. 检查失败路径是否 toast，不允许静默吞错。
5. 确认页面字段映射集中在 mapper 函数中。
