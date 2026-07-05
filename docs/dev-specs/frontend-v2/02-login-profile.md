# 02-login-profile — 登录页 + 我的页真实用户对接

## 依赖

必须在 `01-api-foundation.md` 完成后执行，因为本 spec 依赖：

- `miniprogram/api/auth.js`
- `miniprogram/api/mappers.js`（可选）
- 改造后的 `request.js`

## 允许修改文件

| 文件 | 内容 |
|------|------|
| `pages/login/login.js` | 真实登录流程、用户资料获取、登录态保存 |
| `pages/profile/profile.js` | 真实用户信息与设置读取 |

不要修改 WXML/WXSS。

---

## 1. `pages/login/login.js`

### 当前问题

当前 `_doCloudLogin()` 固定调用：

```javascript
userAPI.login('微信用户', '')
```

这属于近似 mock，无法拿到真实昵称/头像。

### 目标行为

点击登录：

1. 按钮进入 loading
2. 调用 `wx.getUserProfile` 获取用户授权资料
3. 授权成功：调用 `userAPI.login(nickName, avatarUrl)`
4. 授权失败：降级为 `userAPI.login('微信用户', '')`，但需要提示“已使用默认昵称登录”
5. 登录成功后调用 `saveLoginState({ openid, user })`
6. 更新 `app.globalData.userInfo` 和 `app.globalData.isLoggedIn`
7. `wx.switchTab({ url: '/pages/focus/focus' })`

### 必须引入

```javascript
const userAPI = require('../../miniprogram/api/user.api');
const { saveLoginState } = require('../../miniprogram/api/auth');
```

### 必须新增方法

```javascript
_getUserProfile()
```

行为：

- 返回 Promise
- 内部调用 `wx.getUserProfile({ desc: '用于完善专注时钟用户资料' })`
- resolve `{ nickName, avatarUrl }`
- fail 时 resolve `{ nickName: '微信用户', avatarUrl: '' }`，不要 reject

### `_doCloudLogin()` 重写要求

- 必须是 `async`
- 必须 try/catch
- catch 中恢复按钮状态
- 成功后不再调用旧 `wx.cloud.callFunction({ name: 'login' })`

### 禁止

- 不要再直接操作 `wx.setStorageSync('openid'...)`，改用 `saveLoginState`
- 不要保留固定 `userAPI.login('微信用户', '')` 作为唯一路径

---

## 2. `pages/profile/profile.js`

### 当前问题

`summaryStats`、`monthlyGoal`、`isLoggedIn` 都是 mock。

### 目标行为

`onLoad()`：

1. 读取本地登录态 `getLoginState()`
2. 如果未登录：`isLoggedIn=false`，页面保持未登录状态
3. 如果已登录：
   - 调 `userAPI.getInfo()` 获取用户基本信息
   - 调 `userAPI.getSettings()` 获取用户设置
   - 设置 data：`isLoggedIn=true`, `userInfo`, `settings`
4. 如果 `userAPI.getInfo()` 返回 404，清理本地登录态并显示未登录

### 必须引入

```javascript
const userAPI = require('../../miniprogram/api/user.api');
const { getLoginState, clearLoginState } = require('../../miniprogram/api/auth');
```

### data 追加字段

```javascript
userInfo: null,
settings: null,
```

### onLogout()

退出登录时必须：

- 调 `clearLoginState()`
- `app.globalData.userInfo = null`
- `app.globalData.isLoggedIn = false`
- `this.setData({ isLoggedIn: false, userInfo: null, settings: null })`

### 设置开关

`onSwitchTap()` 暂时仍可只更新本地 UI，不强制写后端。
如果改了 `dailyGoal/focusDuration`，才调用 `userAPI.updateSettings()`。

---

## 验收检查

- [ ] 登录页调用 `wx.getUserProfile`
- [ ] 授权失败可降级登录
- [ ] 登录成功通过 `saveLoginState` 保存登录态
- [ ] 登录页不再直接 `wx.setStorageSync('openid'...)`
- [ ] Profile 页从 `userAPI.getInfo/getSettings` 获取数据
- [ ] Profile 退出登录会 `clearLoginState`
- [ ] 未修改 WXML/WXSS
