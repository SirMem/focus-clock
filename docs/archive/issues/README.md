# Issue 工作清单

> 每个 Issue 包含完整的需求说明、实现细节、验收标准和验证方法。
> 开发者按照对应 Issue 文件开发即可，不需要额外沟通。

---

## 开发顺序

| 顺序 | Issue | 认领人 | 工时 | 依赖 | 文件数 |
|------|-------|--------|------|------|--------|
| **0** | **Shared 层**（已由架构师完成） | — | — | — | 8 |
| **1** | [Task 待办模块 CRUD](./01-task-module.md) | @开发者B | 4h | 无 | 4 |
| **2** | [Session 专注会话模块](./02-session-module.md) | @开发者B | 3h | 无（与 #1 无冲突） | 4 |
| **3** | [Stats 统计模块](./03-stats-module.md) | @开发者C | 3h | #2 完成后可复用 daily-summary | 1-2 |
| **4** | [Diary 日记模块 CRUD](./04-diary-module.md) | @开发者C | 3h | 无 | 4 |
| **5** | [User 用户模块](./05-user-module.md) | @开发者C | 2h | 无 | 3 |
| **6** | [Coach AI 教练模块](./06-coach-module.md) | @待定 | 3h | #2 完成（依赖 session 数据） | 2 |

## 并行策略

```
开发者B: Issue #1 (Task) → Issue #2 (Session)
         两个模块关联性强（Session 可关联 Task），适合同一人

开发者C: Issue #3 (Stats) → Issue #4 (Diary) → Issue #5 (User)
         三个模块各自独立，无代码冲突，可任意顺序开发
         注意 #3 依赖 #2 的 daily-summary.repo.js，后者由 @B 先创建

开发者? : Issue #6 (Coach) — 可延后，不阻塞其他模块
```

## 文件认领总表

```
cloudfunctions/focus-api/
├── index.js                         # ✅ 架构师已完成
├── package.json                     # ✅ 架构师已完成
├── config/index.js                  # ✅ 架构师已完成
├── middleware/auth.js                # ✅ 架构师已完成
├── middleware/validate.js            # ✅ 架构师已完成
├── middleware/response.js            # ✅ 架构师已完成
├── utils/helpers.js                 # ✅ 架构师已完成
├── routes/
│   ├── task.routes.js               # 🔲 Issue #1
│   ├── session.routes.js            # 🔲 Issue #2
│   ├── stats.routes.js              # 🔲 Issue #3
│   ├── diary.routes.js              # 🔲 Issue #4
│   ├── user.routes.js               # 🔲 Issue #5
│   └── coach.routes.js              # 🔲 Issue #6
├── services/
│   ├── task.service.js              # 🔲 Issue #1
│   ├── session.service.js           # 🔲 Issue #2
│   ├── diary.service.js             # 🔲 Issue #4
│   └── coach.service.js             # 🔲 Issue #6
└── repositories/
    ├── task.repo.js                 # 🔲 Issue #1
    ├── session.repo.js              # 🔲 Issue #2
    ├── daily-summary.repo.js        # 🔲 Issue #2
    └── diary.repo.js                # 🔲 Issue #4 (or #3)
    └── user.repo.js                 # 🔲 Issue #5

miniprogram/api/
├── request.js                       # ✅ 架构师已完成
├── task.api.js                      # 🔲 Issue #1
├── session.api.js                   # 🔲 Issue #2
├── diary.api.js                     # 🔲 Issue #4
└── user.api.js                      # 🔲 Issue #5
```

## 如何创建 GitHub Issue

将每个 markdown 文件的内容粘贴到 GitHub Issues 中，或在项目根目录执行：

```bash
# 需要先安装 gh CLI 并登录
gh issue create --title "[Task] 待办模块 CRUD" --body "$(cat docs/issues/01-task-module.md)" --label "module/task"
gh issue create --title "[Session] 专注会话模块" --body "$(cat docs/issues/02-session-module.md)" --label "module/session"
gh issue create --title "[Stats] 统计查询模块" --body "$(cat docs/issues/03-stats-module.md)" --label "module/stats"
gh issue create --title "[Diary] 日记模块 CRUD" --body "$(cat docs/issues/04-diary-module.md)" --label "module/diary"
gh issue create --title "[User] 用户模块" --body "$(cat docs/issues/05-user-module.md)" --label "module/user"
gh issue create --title "[Coach] AI 教练模块" --body "$(cat docs/issues/06-coach-module.md)" --label "module/coach"
```

## Branch 策略建议

每个 Issue 一个分支，命名格式：`feature/issue-N-module-name`

```
git branch feature/issue-1-task-crud
git branch feature/issue-2-session
git branch feature/issue-3-stats
# ...
```

完成后提 PR → Code Review → Merge 到 `master`。
