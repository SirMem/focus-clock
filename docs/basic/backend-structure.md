# 后端架构设计

> 详细架构方案见 [backend-architecture-v2.md](../backend-architecture-v2.md)

## 架构决策

- **云函数组织**：单云函数 + tcb-router（一个 `focus-api` 函数，内部路由分发）
- **分层模式**：`middleware/` → `routes/` → `services/` → `repositories/`
- **依赖注入**：手动工厂函数，不引入 DI 容器

## 适用范围

后端服务采用微信云开发 CloudBase，包含以下模块：

| 模块 | 状态 | 说明 |
|------|------|------|
| 专注 | ✅ 已有 | `completeFocusSession` 云函数 |
| 待办 | 🔲 新建 | 在 `focus-api` 中实现 CRUD |
| 统计 | 🔲 新建 | 日/周/月聚合查询 |
| 日记 | 🔲 新建 | 在 `focus-api` 中实现 CRUD |
| 用户 | ✅ 已有 + 扩展 | `login` 云函数 + 设置管理 |
| AI教练 | 🔲 新建 | 外部 LLM API 对接 |

## API 接入面

- 调用方式：`wx.cloud.callFunction({ name: 'focus-api', data: { $url: 'xxx', ... } })`
- 统一返回格式：`{ code: number, data: any, message: string }`
- 路由前缀命名：`module/action`（如 `task/create`、`stats/weekly`）

## 维护规则

- 每次新增模块或修改架构后，同步更新 [backend-architecture-v2.md](../backend-architecture-v2.md)
- 接口契约变更需更新 [api-contracts.md](../api-contracts.md)（待创建）
