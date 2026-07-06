# 07-login-fix — 合规微信登录 + 头像昵称主动填写

> 状态: ✅ 已按合规方案重写  
> 审计: `wx.getUserProfile` 已废弃，登录鉴权与头像昵称采集必须拆分  
> 契约来源: [`../../api-contracts.md`](../../api-contracts.md) §2

---

## 1. 核心结论

微信登录模块分两条独立链路：

| 链路 | 目标 | 技术方案 |
|---|---|---|
| 登录鉴权 | 识别用户、建立登录态 | `wx.login()` → code → 后端 `jscode2session` → openid → 本地登录态 |
| 资料采集 | 用户主动填写头像昵称 | `button[open-type=chooseAvatar]` + `input[type=nickname]` → 上传头像 → `user/profile/update` |

禁止继续使用：

```js
wx.getUserProfile()
```

原因：基础库 2.27.1+ 不再返回真实头像昵称，只返回默认头像和“微信用户”。当前项目基础库为 3.7.12。

---

## 2. P0 实现范围

### 2.1 Login 页

文件：`pages/login/login.js`

要求：

1. 点击登录按钮后调用 `wx.login()`。
2. 获取 `res.code` 后调用 `userAPI.login(code)`。
3. 不采集昵称头像。
4. 不调用 `wx.getUserProfile`。
5. 登录成功后保存 `{ openid, user }` 到本地登录态并 `wx.switchTab('/pages/focus/focus')`。

前端 API：`miniprogram/api/user.api.js`

```js
login(code) {
  return callAPI('user/login', { code });
}
```

### 2.2 后端 login 路由

文件：`cloudfunctions/focus-api/routes/user.routes.js`

要求：

1. `user/login` 接收 `{ code }`。
2. 使用 `WX_APP_SECRET` + appid 调用微信 `jscode2session`。
3. 只返回 `openid` 与用户基础信息。
4. **不得返回 `session_key` 给小程序端。**
5. 不接收、不写入 `nickName/avatarUrl`。

环境变量：

```text
WX_APP_SECRET=<微信小程序 AppSecret>
```

若未配置，登录应失败并提示微信登录校验失败；不能静默伪造合规链路。

### 2.3 Profile 页头像昵称采集

文件：

- `pages/profile/profile.js`
- `pages/profile/profile.wxml`
- `pages/profile/profile.wxss`

要求：

1. 头像使用：

```html
<button open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
```

2. 昵称使用：

```html
<input type="nickname" bindblur="onNicknameBlur" />
```

3. 头像选择后先本地预览，不立即写入登录接口。
4. 点击“保存资料”时：
   - 若头像是临时路径，先 `wx.cloud.uploadFile` 上传云存储。
   - 再调用 `userAPI.updateProfile({ nickName, avatarUrl })`。
5. 保存成功后更新页面状态、`app.globalData.userInfo` 和本地 `userInfo` 缓存。

### 2.4 后端 profile update 路由

新增路由：

```text
user/profile/update
```

要求：

1. 走普通 auth 中间件，必须已登录。
2. 仅更新当前 `ctx.OPENID` 对应用户。
3. 服务端校验：
   - `nickName` 必须是字符串，trim 后最长 20 字符。
   - `avatarUrl` 必须是 `cloud://` 或 `https://`，最长 500 字符。
4. 不允许通过 `user/login` 修改用户资料。

---

## 3. 验收检查

- [ ] 全项目无 active `wx.getUserProfile`。
- [ ] Login 页调用 `wx.login()`，并把 `code` 传给 `user/login`。
- [ ] 后端 `user/login` 调用微信 `jscode2session`。
- [ ] 后端不向小程序端返回 `session_key`。
- [ ] `user/login` 不再接收 `nickName/avatarUrl`。
- [ ] Profile 页头像按钮能触发 `chooseAvatar`。
- [ ] Profile 页昵称输入框使用 `type="nickname"`。
- [ ] 保存资料调用 `user/profile/update`。
- [ ] 头像临时路径会上传到云存储后再保存。
- [ ] 保存成功后本地缓存同步更新。

---

## 4. P1 后续项

- 服务端保存 session_key 或自定义 sessionId，支持更严格的自定义登录态。
- 头像文件大小 / MIME 类型进一步校验。
- 独立资料完善页：登录后如果昵称/头像为空，引导用户完善资料。
