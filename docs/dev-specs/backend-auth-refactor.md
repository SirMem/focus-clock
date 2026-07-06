# 后端身份与用户唯一性重构

## 背景

登录调试中发现两个问题：

1. `user/login` 按 `_openid` 查询后再 `add()`，并发或重复点击时可能为同一 OPENID 创建多个随机 `_id` 用户文档。
2. 非登录接口依赖 `event.userInfo.OPENID`，当云函数上下文没有按该字段注入时会返回 401，前端随即清理登录态并回到登录页。

## 当前决策

- 服务端全局使用 `wx-server-sdk`。
- 用户可信身份统一来自 `cloud.getWXContext().OPENID`。
- 前端不得传 openid；前端 storage 中的 openid 仅作为 UI 登录态缓存，不作为服务端鉴权依据。
- `users` 集合以 OPENID 作为文档 `_id`，即 `users/{OPENID}`。
- 登录是静默身份登录；首次登录默认昵称为 `微信用户`。
- 头像昵称后续通过 Profile 页 `chooseAvatar` / `type="nickname"` 完善。

## 影响范围

### 服务端

- `cloudfunctions/focus-api/utils/cloud.js` 统一初始化 `wx-server-sdk`。
- `middleware/auth.js` 通过 `getOpenId()` 设置 `ctx.OPENID`。
- `routes/user.routes.js` 的 `user/login` 不再依赖 `WX_APP_SECRET` / `jscode2session`。
- 各 repository 不再直接初始化 `@cloudbase/node-sdk`，统一使用 `getDb()`。
- `UserRepo` 会在发现历史重复 users 时收敛为 `users/{OPENID}` 并删除重复文档。

### 前端

- 前端 API 请求仍通过 `wx.cloud.callFunction`，不显式传 openid。
- 登录页仍可传 `code` 以兼容旧方法签名，但服务端不依赖该 code。

## 历史重复用户清理

`UserRepo._ensureCanonicalUser()` 会在每次 `findByOpenId()` 时自动收敛历史重复文档
为 `users/{OPENID}` 并移除冗余副本。无需单独调用维护接口。

若需在部署前手动检查/清理，可在云函数内直接调用 `UserRepo` 工具方法：

```js
const repo = UserRepo.create();
console.log(await repo.cleanupDuplicateUsers({ dryRun: true }));
await repo.cleanupDuplicateUsers({ dryRun: false });
```

> `cleanupDuplicateUsers` 是 repo 内部工具方法，不暴露为 HTTP 路由。

## 部署步骤

1. 在 `cloudfunctions/focus-api` 安装依赖：

   ```bash
   npm install
   ```

2. 在微信开发者工具中右键 `cloudfunctions/focus-api`，选择“上传并部署：云端安装依赖”。
3. 清除开发者工具缓存并重新编译小程序。

## 验证步骤

1. 清空本地 storage。
2. 点击登录，确认进入主 Tab。
3. 切到 Profile，确认显示 `微信用户` 而不是“点击登录”。
4. 查看云函数日志，确认 `user/info` / `user/settings/get` 不再返回 401。
5. 多次登录后检查 `users` 集合，同一 `_openid` 应只保留一个文档，且 `_id` 等于 OPENID。
