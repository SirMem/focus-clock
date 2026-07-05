# Dev Specs 使用说明

## 这是什么

每个 `.md` 文件是一份精确到函数签名级的实现规范。
stateless Claude Code 窗口拿到它后，**不需要任何项目上下文**，照着写就能产出符合架构的代码。

## 文件清单

| 文件 | 实现内容 | 状态 |
|------|---------|:----:|
| ~~`01-task.md`~~ | ~~Task CRUD 后端 + 前端 API~~ | ✅ 已完成，已归档 |
| ~~`02-diary.md`~~ | ~~Diary CRUD 后端 + 前端 API~~ | ✅ 已完成，已归档 |
| `03-stats.md` | Stats 查询后端 | 🔲 待实现 |
| `04-user.md` | User 登录 + 设置后端 + 前端 API | 🔲 待实现 |
| `05-frontend.md` | 前端 6 个页面对接真实 API | 🔲 待实现 |

## 使用方法

1. 我审核 spec 文档内容
2. 确认无误后，每个 spec 开一个 stateless 窗口
3. 把 spec 内容粘贴给窗口，窗口执行
4. 窗口完成后，我 review diff
5. 合入 main

## 每份 spec 的通用约束（所有窗口必须遵守）

- 工作目录: `F:\Design WeChat Mini Program`
- 不要修改 `cloudfunctions/focus-api/index.js`（路由已在 main 注册）
- 不要修改其他模块的文件
- 不要创建任何新页面或新目录
- 代码风格参考 `services/session.service.js`：class + constructor DI + static create()
