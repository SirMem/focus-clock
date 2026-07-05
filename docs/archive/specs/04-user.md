# Dev Spec: User 用户模块后端 + 前端 API

## 文件清单

创建以下 2 个文件，修改 1 个文件：

| 操作 | 文件路径 |
|------|---------|
| 创建 | `cloudfunctions/focus-api/repositories/user.repo.js` |
| 创建 | `miniprogram/api/user.api.js` |
| 修改 | `cloudfunctions/focus-api/routes/user.routes.js`（替换全部内容） |

注意：User 模块不需要 service 层，路由直接调用 repo。因为 user/login 和 settings 读写操作简单直接，不需要中间业务逻辑层。

## 1. `repositories/user.repo.js`

### 骨架

```javascript
class UserRepo {

  constructor(db) {
    this.collection = db.collection('users');
  }

  static create() {
    const cloud = require('@cloudbase/node-sdk');
    const app = cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
    return new UserRepo(app.database());
  }

  async findByOpenId(openId) {}
  async upsertUser(openId, userData) {}
  async updateSettings(openId, settings) {}
  async getSettings(openId) {}
}

module.exports = UserRepo;
```

### 方法实现细节

**findByOpenId(openId)**
- `this.collection.where({ _openid: openId }).get()`
- 返回 `res.data[0]` 或 `null`

**upsertUser(openId, { nickName, avatarUrl })**
- 先 `findByOpenId` 查
- 存在: 更新 `nickName`、`avatarUrl`、`updatedAt`、`lastLoginAt`，返回更新后文档
- 不存在: 创建新文档:
```javascript
{
  _openid: openId,
  nickName: nickName || '微信用户',
  avatarUrl: avatarUrl || '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastLoginAt: Date.now(),
  settings: {
    focusDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    dailyGoal: 4,
  }
}
```
- 返回 `{ ...newUser, _id: res.id }`

**getSettings(openId)**
- 查用户 → 返回 `user.settings` 或默认设置对象

**updateSettings(openId, settings)**
- 校验 settings 中允许的字段：`focusDuration`（number, 1-120）、`shortBreak`（number, 1-30）、`longBreak`（number, 1-60）、`dailyGoal`（number, 1-20）
- `this.collection.where({ _openid: openId }).update({ data: { settings, updatedAt: Date.now() } })`

## 2. `routes/user.routes.js`（替换全部内容）

```javascript
const UserRepo = require('../repositories/user.repo');
const { succ, fail } = require('../middleware/response');
const { validate, V } = require('../middleware/validate');

module.exports = (app) => {

  // ═══════════════════════════════════════════════════
  //  user/login
  // ═══════════════════════════════════════════════════

  app.router('user/login', async (ctx) => {
    const { nickName, avatarUrl } = ctx.event;

    const repo = UserRepo.create();
    const user = await repo.upsertUser(ctx.OPENID, { nickName, avatarUrl });

    succ(ctx, {
      openid: ctx.OPENID,
      user: {
        _id: user._id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
      }
    });
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/get
  // ═══════════════════════════════════════════════════

  app.router('user/settings/get', async (ctx) => {
    const repo = UserRepo.create();
    const settings = await repo.getSettings(ctx.OPENID);
    succ(ctx, settings || { focusDuration: 25, shortBreak: 5, longBreak: 15, dailyGoal: 4 });
  });

  // ═══════════════════════════════════════════════════
  //  user/settings/update
  // ═══════════════════════════════════════════════════

  app.router('user/settings/update', async (ctx) => {
    const { settings } = ctx.event;

    if (!settings || typeof settings !== 'object') {
      fail(ctx, 400, '设置数据不能为空');
      return;
    }

    const repo = UserRepo.create();
    await repo.updateSettings(ctx.OPENID, settings);
    succ(ctx, { updated: true });
  });

  // ═══════════════════════════════════════════════════
  //  user/info
  // ═══════════════════════════════════════════════════

  app.router('user/info', async (ctx) => {
    const repo = UserRepo.create();
    const user = await repo.findByOpenId(ctx.OPENID);
    if (!user) {
      fail(ctx, 404, '用户不存在');
      return;
    }
    succ(ctx, {
      _id: user._id,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  });

};
```

## 3. `miniprogram/api/user.api.js`

```javascript
const { callAPI } = require('./request');

const userAPI = {
  login(nickName, avatarUrl) {
    return callAPI('user/login', { nickName, avatarUrl });
  },
  getSettings() {
    return callAPI('user/settings/get');
  },
  updateSettings(settings) {
    return callAPI('user/settings/update', { settings });
  },
  getInfo() {
    return callAPI('user/info');
  },
};

module.exports = userAPI;
```

## 验收检查表

- [ ] 2 个文件已创建，1 个文件已修改
- [ ] `user.repo.js` 的 `upsertUser` 处理了新建和更新两种情况
- [ ] `user.repo.js` 的默认 settings 包含 4 个字段
- [ ] `user/routes.js` 的 settings/update 校验了 settings 存在性
- [ ] 没有修改 `index.js` 或其他模块的文件

## 验证方法

部署到云环境后，在 DevTools Console 执行：

```javascript
// 1. 登录（自动获取 OPENID）
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'user/login', nickName: '测试用户', avatarUrl: '' }
}).then(r => console.log('登录:', r.result));
// 期望: { code: 0, data: { openid: "...", user: { _id: "...", nickName: "测试用户" } } }

// 2. 获取用户信息
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'user/info' }
}).then(r => console.log('用户信息:', r.result));

// 3. 获取设置
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'user/settings/get' }
}).then(r => console.log('设置:', r.result));

// 4. 更新设置
wx.cloud.callFunction({
  name: 'focus-api',
  data: { $url: 'user/settings/update', settings: { dailyGoal: 8 } }
}).then(r => console.log('更新设置:', r.result));
```
