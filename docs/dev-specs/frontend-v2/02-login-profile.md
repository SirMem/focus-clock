# 02-login-profile — 登录鉴权 + 我的页用户资料对接

> 状态: ✅ 已由 `07-login-fix.md` 覆盖并升级
> 注意: 本文件保留为 Login/Profile 主模块说明；具体合规修复以 `07-login-fix.md` 为准。

---

## 依赖

必须在 `01-api-foundation.md` 完成后执行，因为本 spec 依赖：

- `miniprogram/api/auth.js`
- `miniprogram/api/user.api.js`
- `miniprogram/api/request.js`

---

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/login/login.js` | `wx.login()` 鉴权、登录态保存 |
| `pages/profile/profile.js` | 用户信息/设置读取、头像昵称主动采集 |
| `pages/profile/profile.wxml` | `chooseAvatar` + `type="nickname"` |
| `pages/profile/profile.wxss` | 头像按钮/昵称输入/保存按钮样式 |
| `miniprogram/api/user.api.js` | `login(code)`、`updateProfile()` |
| `cloudfunctions/focus-api/routes/user.routes.js` | `user/login`、`user/profile/update` |
| `cloudfunctions/focus-api/repositories/user.repo.js` | 用户资料更新 |

---

## 1. Login 鉴权流程

### 目标行为

点击登录：

1. 按钮进入 loading。
2. 调用 `wx.login()` 获取临时 `code`。
3. 调用 `userAPI.login(code)`。
4. 后端 `user/login` 用 `code + WX_APP_SECRET` 调微信 `jscode2session` 换取 `openid`。
5. 后端创建/读取用户，并返回 `{ openid, user }`。
6. 前端调用 `saveLoginState({ openid, user })`。
7. 更新 `app.globalData.userInfo` 与 `app.globalData.isLoggedIn`。
8. `wx.switchTab({ url: '/pages/focus/focus' })`。

### 禁止

- 禁止调用 `wx.getUserProfile`。
- 禁止把昵称头像塞进 `user/login`。
- 禁止把后端 `session_key` 返回给小程序端。
- 禁止无 `WX_APP_SECRET` 时伪造合规 code2session。

---

## 2. Profile 用户资料流程

### 目标行为

`onLoad()`：

1. 读取本地登录态 `getLoginState()`。
2. 未登录：显示未登录状态。
3. 已登录：并行调用 `userAPI.getInfo()` + `userAPI.getSettings()`。
4. 401/404：清理登录态并提示。
5. 成功：设置 `isLoggedIn=true`, `userInfo`, `settings`, `avatarUrl`, `nickName`。

### 头像采集

```html
<button open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
```

- 用户主动点击头像按钮。
- `onChooseAvatar(e)` 拿到临时 `avatarUrl`。
- 先本地预览，不立即保存。
- 点击保存资料时，若为临时路径则 `wx.cloud.uploadFile` 上传云存储。

### 昵称采集

```html
<input type="nickname" bindblur="onNicknameBlur" />
```

- 用户主动点击昵称输入框。
- 键盘上方展示微信昵称建议。
- `onNicknameBlur` 收集值并标记 dirty。
- 点击保存资料时调用 `userAPI.updateProfile({ nickName, avatarUrl })`。

---

## 3. 验收检查

- [ ] 登录页调用 `wx.login()`。
- [ ] `userAPI.login(code)` 只传 code。
- [ ] 后端 `user/login` 执行 `jscode2session`。
- [ ] 全项目无 active `wx.getUserProfile`。
- [ ] Profile 页头像使用 `open-type="chooseAvatar"`。
- [ ] Profile 页昵称使用 `type="nickname"`。
- [ ] 保存资料调用 `user/profile/update`。
- [ ] 头像临时路径会上传云存储再保存。
- [ ] Profile 退出登录会 `clearLoginState`。
