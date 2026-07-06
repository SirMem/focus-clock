# Dev Specs 使用说明（MVP 救援版）

> 状态: 🚧 当前执行入口 · 最后更新: 2026-07-05

## 这是什么

`docs/dev-specs/` 是面向 stateless Claude Code 窗口 / 多 worktree 并发开发的实现规格目录。

当前项目已经不是绿地开发状态：部分前后端代码已实现，但存在契约漂移和文档陈旧。因此，本目录的当前目标是：

1. 冻结 MVP P0/P1 范围。
2. 统一前后端 API 契约。
3. 指导多个 worktree 并行修复，而不是让每个窗口继续按旧 spec 重写。

## 唯一契约真相源

- API 字段和路由以 [`docs/api-contracts.md`](../api-contracts.md) 为准。
- MVP 救援拆工和并发计划以 [`mvp-rescue-plan.md`](./mvp-rescue-plan.md) 为准。
- 前端真实 API 闭环以 [`frontend-v2/README.md`](./frontend-v2/README.md) 为入口。

## 当前文件状态

| 文件 | 用途 | 状态 |
|------|------|:----:|
| `frontend-v2/README.md` | 前端真实 API 闭环总控 | 🚧 当前执行入口 |
| `frontend-v2/01-api-foundation.md` | API 封装、登录态、mapper 基础设施 | ✅ 基本完成，按需 hardening |
| `frontend-v2/02-login-profile.md` | 登录页 + 我的页真实用户信息/设置 | ✅ 基本完成，按需 hardening |
| `frontend-v2/03-todo.md` | Todo 页真实 CRUD | ✅ 基本完成，按需验证 |
| `frontend-v2/04-focus-session.md` | Focus 任务选择 + session 写入 | ✅ 基本完成，需导航/失败态 polish |
| `frontend-v2/05-stats.md` | Stats 真实数据展示 | 🚧 需修复契约漂移和 mock trend |
| `frontend-v2/06-diary.md` | Diary 真实创建/列表/情绪 | 🚧 需修复 diary 契约漂移 |
| `mvp-rescue-plan.md` | PM 总控、worktree 并发、人手分配、验收门禁 | 🚧 当前新增执行计划 |

## 已归档/旧规格

`docs/archive/` 下内容仅作历史参考，不作为当前实现依据。若 archive 与 `docs/api-contracts.md` 冲突，以 `docs/api-contracts.md` 为准。

## 当前 MVP 救援优先级

```text
1. 契约冻结：docs/api-contracts.md + frontend-v2 specs
2. API/mapper 收敛：尤其 diary.api.js / mappers.js
3. 页面修复：Diary、Stats
4. 导航统一：原生 tabBar + wx.switchTab
5. Login/Profile/Focus 失败态 hardening
6. WeChat DevTools 手工验收
```

## 通用约束

- 工作目录：`F:\Design WeChat Mini Program`
- 优先使用 worktree 隔离并行工作。
- 每个 worktree 只改自己包内文件，避免跨模块顺手重构。
- 不手改 `miniprogram_npm/tdesign-miniprogram/`。
- 不修改 `cloudfunctions/focus-api/index.js`，除非明确需要注册新增路由；当前 MVP 救援不计划新增路由。
- 页面数据结构必须通过 `miniprogram/api/mappers.js` 转换，禁止把后端字段散落到 WXML 绑定里。
- 所有 API 调用必须处理 loading / 失败 toast / 401 登录失效。
- 后端没有的数据，前端不得用 mock 冒充真实数据。

## MVP Done 标准

MVP 只有在以下全部通过后才能标记 done：

- 登录页可真实登录并写入本地登录态。
- Todo 页 CRUD 全走云数据库，刷新不丢数据。
- Focus 页可以选择真实任务并完成 `session/complete` 写入。
- Stats 页展示真实 `stats/today` / `weekly` / `monthly` / `heatmap` 数据或诚实空态。
- Diary 页通过 `diary/create` / `diary/list` 保存和读取真实日记。
- Profile 页展示真实用户信息和设置。
- 原生 tabBar 导航一致，无双 tab。
- API 失败路径有用户可见反馈。
- WeChat DevTools 编译和手工主链路验收通过。

## Review 策略

每个 worktree 完成后，由主窗口执行：

1. `git diff -- <该 worktree 文件范围>` 检查是否越界。
2. 检查是否违反 `docs/api-contracts.md`。
3. 检查是否引入 fake real-data mock。
4. 检查失败路径是否 toast，不允许静默吞错。
5. 确认 mapper 仍是字段转换集中点。
