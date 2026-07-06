# 02-login-profile — 静默登录 + 我的页真实用户对接

## 依赖

必须在 `01-api-foundation.md` 完成后执行，因为本 spec 依赖：

- `miniprogram/api/auth.js`
- `miniprogram/api/user.api.js`
- `miniprogram/api/request.js`
- `cloudfunctions/focus-api` 的 `wx-server-sdk` 身份上下文

## 服务端登录语义

- 前端不传 openid。
- 服务端通过 `wx-server-sdk` 的 `cloud.getWXContext().OPENID` 获取可信用户身份。
- `users` 集合以 OPENID 作为文档 `_id`：`users/{OPENID}`。
- 首次登录默认 `nickName` 为 `微信用户`、`avatarUrl` 为空。
- 头像昵称不在登录过程中弹窗采集，而是在 Profile 页通过 `chooseAvatar` / `type="nickname"` 主动完善。

---

## 1. `pages/login/login.js`

### 目标行为

点击登录：

1. 按钮进入 loading。
2. 调用 `wx.login()` 获取 code（兼容旧接口形态；服务端不再依赖 code 换 openid）。
3. 调用 `userAPI.login(code)`。
4. 登录成功后调用 `saveLoginState({ openid, user })`。
5. 更新 `app.globalData.userInfo` 和 `app.globalData.isLoggedIn`。
6. `wx.switchTab({ url: '/pages/focus/focus' })`。

### 禁止

- 不要在登录页调用 `wx.getUserProfile`。
- 不要在登录页弹出头像昵称填写框。
- 不要由前端传 openid。
- 不要直接操作 `wx.setStorageSync('openid'...)`，改用 `saveLoginState`。

---

## 2. `pages/profile/profile.js`

### 目标行为

`onLoad()`：

1. 只做页面尺寸初始化。

`onShow()`：

1. 调 `_loadProfile()`。
2. `_loadProfile()` 读取本地登录态 `getLoginState()`。
3. 如果未登录：`isLoggedIn=false`，页面保持未登录状态。
4. 如果已登录：
   - 调 `userAPI.getInfo()` 获取用户基本信息。
   - 调 `userAPI.getSettings()` 获取用户设置。
   - 设置 data：`isLoggedIn=true`, `userInfo`, `settings`, `avatarUrl`, `nickName`。
5. 如果 `userAPI.getInfo()` 返回 401/404，清理本地登录态并显示未登录。

### 资料完善

- 头像：`button[open-type=chooseAvatar]`。
- 昵称：`input[type=nickname]`。
- 点击保存后调用 `userAPI.updateProfile({ nickName, avatarUrl })`。

### onLogout()

退出登录时必须：

- 调 `clearLoginState()`。
- `app.globalData.userInfo = null`。
- `app.globalData.isLoggedIn = false`。
- `this.setData({ isLoggedIn: false, userInfo: null, settings: null })`。

---

## 验收检查

- [ ] 登录页不调用 `wx.getUserProfile`。
- [ ] 登录页不弹头像昵称填写框。
- [ ] 登录成功通过 `saveLoginState` 保存登录态。
- [ ] 登录页不直接 `wx.setStorageSync('openid'...)`。
- [ ] Profile 页在 `onShow` 从 `userAPI.getInfo/getSettings` 获取数据。
- [ ] Profile 页使用 `chooseAvatar` / `type="nickname"` 更新资料。
- [ ] Profile 退出登录会 `clearLoginState`。
