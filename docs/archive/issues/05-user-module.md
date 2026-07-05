# Issue #5: User 用户模块

> **认领人**: @开发者C
> **状态**: 🔲 待开发
> **预估工时**: 2h
> **标签**: `module/user`, `priority/p1`

---

## 概要

实现用户信息查询、设置更新和登录注册接口。登录时自动创建用户文档（if not exists）。

## 参考文档

| 文档 | 说明 |
|------|------|
| `docs/api-contracts.md §6` | 接口入参/出参定义 |

## 你需要创建/修改的文件

```
需要创建:
  cloudfunctions/focus-api/repositories/user.repo.js
  miniprogram/api/user.api.js

需要修改:
  cloudfunctions/focus-api/routes/user.routes.js
```

## 重要说明

**User 模块没有独立的 Service 层**。业务逻辑简单（CRUD + 登录），直接在 routes 中调用 Repo 的方法。理由：

- 登录逻辑只有"查存在 → 不存在则创建 → 返回"
- 更新设置没有业务规则
- 减少不必要的抽象

## 详细实现要求

### 1. `repositories/user.repo.js`

操作 `users` 集合。

**方法**：

| 方法 | 说明 |
|------|------|
| `static create()` | 工厂方法 |
| `findByOpenId(openId)` | 按 OPENID 查询用户 |
| `insert(data)` | 创建用户 |
| `updateByOpenId(openId, data)` | 按 OPENID 更新用户设置 |

### 2. `routes/user.routes.js`

#### user/login

登录/自动注册逻辑：

```javascript
app.router('user/login', async (ctx) => {
  const { OPENID } = ctx;

  const repo = UserRepo.create();
  let user = await repo.findByOpenId(OPENID);
  let isNew = false;

  if (!user) {
    // 新用户 → 自动注册
    const defaultSettings = {
      sound: 'none',
      focusDuration: 25 * 60,
      shortBreakDuration: 5 * 60,
      longBreakDuration: 15 * 60,
      dailyGoal: 8,
    };
    const newUser = {
      _openid: OPENID,
      settings: defaultSettings,
      stats: { totalPomodoros: 0, currentStreak: 0, longestStreak: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const result = await repo.insert(newUser);
    user = { ...newUser, _id: result._id };
    isNew = true;
  }

  succ(ctx, { isNew, user });
});
```

#### user/info

查询用户信息和聚合统计数据（累计番茄数从 sessions 表统计，连续天数实时计算）。

**返回的数据聚合**：

- `stats.totalPomodoros`：查 sessions 表 count `{ _openid, isPomodoro: true }`
- `stats.currentStreak` 和 `stats.longestStreak`：在 repositories 层或 routes 层计算

#### user/update

更新用户文档的 settings 字段。

```javascript
app.router('user/update', async (ctx) => {
  const { settings, nickName, avatarUrl } = ctx.event;
  const data = { updatedAt: Date.now() };
  if (settings) data.settings = settings;
  if (nickName !== undefined) data.nickName = nickName;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

  const repo = UserRepo.create();
  await repo.updateByOpenId(ctx.OPENID, data);
  succ(ctx, { updated: 1 });
});
```

### 3. `miniprogram/api/user.api.js`

```javascript
const { callAPI } = require('./request');

const userAPI = {
  login() {
    return callAPI('user/login');
  },
  info() {
    return callAPI('user/info');
  },
  update(data) {
    return callAPI('user/update', data);
  },
};

module.exports = userAPI;
```

## 与现有云函数的关系

- `cloudfunctions/login/index.js` — 后续可用 `user/login` 替代。现有云函数保持不动，迁移策略见架构文档 §8
- 本 Issue **不要求**删除旧云函数

## 验收标准

- [ ] `user/login` 首次调用创建用户文档，再次调用返回已有数据
- [ ] `user/info` 返回用户信息 + 实时聚合的统计数据
- [ ] `user/update` 正确更新设置字段
- [ ] 新用户默认值正确（音效: 'none', 专注时长: 25min 等）
- [ ] 幂等：多次调用 `user/login` 不会创建重复文档
