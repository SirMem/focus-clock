# Spec: 日记页 & 个人页 后端数据对接

> 状态: ✅ 已完结 · 所有 7 个 tickets 已部署到 master（commits: 082d519, 1066d88, 2c5effe）
> 目标版本: v1.3.0

---

## Problem Statement

专注时钟微信小程序的「日记页」和「个人页」已完成静态设计稿开发（Figma 转写），所有数据显示和交互状态使用硬编码假数据填充：

**日记页** (`pages/diary/`) — 情绪选择器、AI 引导提示、今日任务摘要、历史记录列表、详情视图的统计指标（番茄数/专注时长/完成任务）全部展示为 `--` 或占位文案，保存操作虽已调用 API 但数据流未验证。

**个人页** (`pages/profile/`) — 成就勋章（12 个徽章）为硬编码固定状态、数据导出为 `setTimeout` 模拟、意见反馈仅本地 `setData` 不持久化、应用评分为本地模拟、主题设置仅存本地 `Storage` 不跨设备同步。三个开关（通知/音效/振动）虽已调用 API 但未验证端到端流程。

此外，后端存在多个路由缺失（成就模块、反馈、评分、导出），前端部分 API 调用签名与后端契约不一致。

用户的核心体验链路——**写日记→查历史→看统计** 和 **看资料→设偏好→攒成就**——因此断裂。

---

## Solution

### 概览

将两页的设计稿假数据逐块替换为真实后端数据流。后端补齐缺失的接口，前端修正调用签名，使整个数据链路贯通。

### 链路模型

```
页面 data (原设计稿假值) 
    ↓ 替换
API Wrapper 调用 (api/*.api.js)
    ↓ 
wx.cloud.callFunction('focus-api')
    ↓
tcb-router 路由分发 → routes → services → repos → 云数据库
    ↓
返回 { code: 0, data: T } → setData 驱动 WXML 渲染
```

### 涉及模块

| 层级 | 文件 | 操作 |
|------|------|------|
| 页面 | `pages/diary/diary.js` | 修正 API 调用签名，补详情统计，加编辑/删除 UI |
| 页面 | `pages/diary/diary.wxml` | 加编辑/删除按钮，详情统计绑定真实数据 |
| 页面 | `pages/profile/profile.js` | 成就/导出/反馈/评分替换为 API 调用 |
| API 层 | `miniprogram/api/*.api.js` | 新增 `coach.api.js`（成就）、`user.api.js`（feedback/rating） |
| 后端 | `cloudfunctions/focus-api/` | 新增 `achievement/`, `feedback/`, `rating/`, `export/` 模块 |

---

## User Stories

### Diary 页

1. As a 用户, I want to **选择当天心情**后写日记内容，保存后日记存入云端数据库， so that 数据不会因清缓存丢失
2. As a 用户, I want to **查看今日已完成任务摘要**和**今日专注统计**， so that 写日记时有当日数据参考
3. As a 用户, I want to **查看历史日记列表**（支持按日期和情绪筛选）， so that 我可以回顾之前的记录
4. As a 用户, I want to **点击一篇历史日记查看详情**，详情页展示当天的番茄数、专注时长、完成任务数， so that 我可以结合当日统计数据回顾
5. As a 用户, I want to **在日记详情页编辑**内容或心情标签， so that 修改后数据持久化
6. As a 用户, I want to **在日记详情页删除**一篇日记， so that 可以管理自己的记录
7. As a 用户, I want to **日期筛选和情绪筛选同时生效**， so that 可以精确定位想要的日记
8. As a 用户, I want to **选择"上月"筛选时看到上个月所有日记**，而不仅限于最近 50 条， so that 筛选结果完整

### Profile 页

9. As a 用户, I want to **在个人主页看到真实统计数据**（累计专注/连续打卡/获得勋章数）， so that 了解自己的整体情况
10. As a 用户, I want to **修改头像和昵称后保存**，数据持久化到云端， so that 换设备后资料还在
11. As a 用户, I want to **切换通知/音效/振动开关**，状态持久化到云端设置， so that 偏好跨设备同步
12. As a 用户, I want to **在「个人目标」子视图设置并保存**专注时长/月度目标/每日番茄数， so that 偏好永久生效
13. As a 用户, I want to **在「成就勋章」子视图看到真实解锁状态**，已达成勋章显示获得时间， so that 勋章与真实使用情况一致
14. As a 用户, I want to **在「成就勋章」子视图看到未解锁勋章的进度百分比**（如"钻石专注 64%"）， so that 知道距离达成还差多少
15. As a 用户, I want to **在「数据导出」子视图看到真实的数据量**（专注记录数、日记条目数、任务记录数）， so that 了解可导出的数据规模
16. As a 用户, I want to **提交意见反馈后**数据存入云端， so that 开发者可以看到
17. As a 用户, I want to **评分提交后**数据持久化， so that 不会因为退出重进又弹评分
18. As a 用户, I want to **主题设置保存后**同步到云端， so that 换设备后主题一致

---

## Implementation Decisions

### 1. 后端新增模块

#### 1.1 Achievement 成就模块

新增 `routes/achievement.routes.js` + `services/achievement.service.js`，**不新增 Repo**（直接查已有集合）。

**路由**:

| 路由 | 方法 | 说明 |
|------|------|------|
| `achievement/list` | GET | 返回用户 12 个勋章的解锁状态和进度 |

**判定逻辑（规则引擎，不接 LLM）**：

```javascript
// 从 sessions + daily_summaries 聚合用户数据
// 每条规则独立 if/else 判断
const RULES = [
  { id: 1,  name: '坚持达人',   check: ({streak}) => streak >= 7 },
  { id: 2,  name: '番茄收割机',  check: ({totalPomodoros}) => totalPomodoros >= 50 },
  { id: 3,  name: '心流状态',   check: ({maxDailyPomodoros}) => maxDailyPomodoros >= 10 },
  { id: 4,  name: '学习狂人',   check: ({studyMinutes}) => studyMinutes >= 1200 },
  { id: 5,  name: '晨型人',    check: ({earlyDayCount}) => earlyDayCount >= 5 },
  { id: 6,  name: '月度冠军',   check: ({monthlyMinutes}) => monthlyMinutes >= 2400 },
  { id: 7,  name: '钻石专注',   check: ({totalMinutes}) => totalMinutes >= 12000 },
  { id: 8,  name: '百日打卡',   check: ({streak}) => streak >= 100 },
  { id: 9,  name: '目标猎人',   check: ({consecutiveGoalMonths}) => consecutiveGoalMonths >= 3 },
  { id: 10, name: '夜枭专注',   check: ({nightPomodoros}) => nightPomodoros >= 5 },
  { id: 11, name: '闪电模式',   check: ({maxSingleSession}) => maxSingleSession >= 120 },
  { id: 12, name: '全球同步',   check: () => false /* 社交功能，暂不可达 */ },
];
```

进度百分比 = `Math.min(100, Math.round(current / target * 100))`，目标值在每条规则中定义。

**响应格式**:

```typescript
{
  code: 0,
  data: {
    achievements: Array<{
      id: number;
      name: string;
      icon: string;
      desc: string;
      earned: boolean;
      earnedDate: string | null;  // "6月21日" 格式
      progress: number;           // 0-100，未解锁时
    }>;
  }
}
```

#### 1.2 Feedback 反馈模块

新增 `routes/feedback.routes.js`，**不新增 Service**（逻辑极简）。

| 路由 | 方法 | 说明 |
|------|------|------|
| `feedback/submit` | POST | 写入 `feedbacks` 集合 |

**请求**: `{ content: string }` (1-500 字符)
**响应**: `{ code: 0, data: { _id: string } }`

**数据库集合**: `feedbacks`，字段 `{ _openid, content, createdAt }`

#### 1.3 Rating 评分模块

| 路由 | 方法 | 说明 |
|------|------|------|
| `rating/submit` | POST | 写入 `ratings` 集合 |

**请求**: `{ score: number }` (1-5)
**响应**: `{ code: 0, data: { _id: string } }`

**数据库集合**: `ratings`，字段 `{ _openid, score, createdAt }`

#### 1.4 Export 导出模块

| 路由 | 方法 | 说明 |
|------|------|------|
| `export/stats` | GET | 返回数据概览（记录数） |
| `export/data` | GET | 返回指定格式的数据 |

**请求** (`export/data`): `{ range: 'week' | 'month' | 'all', format: 'csv' | 'json' | 'pdf' }`
**响应** (JSON): `{ code: 0, data: { records: [...], totalCounts: {...} } }`

P0 版本只返回 JSON 数据让前端处理后保存为文件；PDF 生成标记为 P2。

### 2. 前端修正

#### 2.1 日记 API 调用签名修正

`diary.js` 中 `taskAPI.list({ isDone: true }, 1, 20)` → 改为：

```javascript
taskAPI.list({ filter: { isDone: true }, page: 1, pageSize: 20 })
```

#### 2.2 日记详情统计

`_openDetail()` 中新增异步加载当日统计：

```javascript
async _openDetail(entry) {
  const statsRes = await statsAPI.today();
  // 填充 dtl-stats-row 的三个指标
}
```

#### 2.3 日记筛选服务端化

`_loadEntries()` 的 `diaryAPI.list()` 调用改为传递筛选参数：

```javascript
diaryAPI.list({ 
  pageSize: 50,
  date: activeDateFilter,      // YYYY-MM-DD 格式或空
  emotionTag: activeEmotion,   // 中文标签或空
})
```

#### 2.4 成就勋章动态化

`profile.js` 删掉 12 个硬编码 `achievements` 数组，改为：

```javascript
async _loadAchievements() {
  const res = await coachAPI.achievements();
  // res.data.achievements → setData 到 filteredAchievements
}
```

需要新增 `coach.api.js` 中的 `achievements()` 方法。

#### 2.5 反馈/评分 API

```javascript
// feedback
async onFeedbackSubmit() {
  const res = await userAPI.submitFeedback(this.data.feedbackText);
  // 成功后显示感谢状态
}

// rating
async onRatingSubmit() {
  const res = await userAPI.submitRating(this.data.rating);
  // 成功后显示感谢评分
}
```

需要扩展 `user.api.js` 新增 `submitFeedback()` 和 `submitRating()`。

#### 2.6 主题设置云端同步

保存到本地 Storage 的同时调用 `userAPI.updateSettings()`：

```javascript
async onThemeSave() {
  // 先存本地
  wx.setStorageSync('theme_mode', this.data.themeMode);
  // 再存云端
  await userAPI.updateSettings({
    themeMode: this.data.themeMode,
    themeAccent: this.data.themeAccent,
    themeFontSize: this.data.themeFontSize,
  });
}
```

`user.repo.js` 的 settings 白名单需扩展 `themeMode` / `themeAccent` / `themeFontSize`。

#### 2.7 数据导出真实化

`_initExportView()` 改为调 `exportAPI.getStats()` 获取真实数字：

```javascript
async _initExportView() {
  const res = await exportAPI.getStats();
  // res.data → exportStats
}
```

需要新增 `export.api.js`。

### 3. 数据库集合变更

| 集合 | 操作 | 字段 |
|------|------|------|
| `feedbacks` | 新建 | `{ _openid, content, createdAt }` |
| `ratings` | 新建 | `{ _openid, score, createdAt }` |
| `users` 的 settings | 白名单扩展 | 新增 `themeMode`, `themeAccent`, `themeFontSize` |

---

## Testing Decisions

由于本项目没有测试框架（无 Jest / Mocha），验收方式为：

**验收方法**:
1. 开发者在微信开发者工具中逐条验证 User Stories
2. 使用 `console.log` 追踪 API 请求/响应
3. 云函数日志查看后端执行结果
4. 云开发控制台数据库查看数据写入是否正确

**验收清单（按 User Story 编号）**:

| Story | 验证方法 |
|-------|---------|
| #1 | 写日记保存后 → 云开发 console 看 `diaries` 集合有新记录 |
| #2 | 今日摘要区域展示真实的任务完成数和番茄数 |
| #3 | 历史列表显示后端返回的日记，筛选生效 |
| #4 | 点击日记进入详情，三个统计指标显示数字而非 `--` |
| #5 | 编辑内容后保存，数据库对应文档更新 |
| #6 | 删除后数据库文档移除，列表刷新 |
| #7 | 同时筛选日期和情绪，结果正确 |
| #8 | 选"上月"看到全部记录而非仅前 50 条 |
| #9-11 | 个人主页三个摘要数值、资料编辑、开关状态与数据库一致 |
| #12 | 保存目标后重新进入，值恢复为保存值 |
| #13-14 | 成就状态与用户实际聚焦数据一致 |
| #15 | 导出页数字与数据库统计一致 |
| #16-17 | 反馈和评分写入 `feedbacks` / `ratings` 集合 |
| #18 | 云端 settings 中包含 theme 字段 |

---

## Out of Scope

- **照片上传/语音输入** — P2，保持 Toast 占位
- **PDF 导出** — P2，CSV/JSON 先做
- **全球同步勋章** — 社交功能，不实现（代码中已标注 `check: () => false`）
- **日记 AI 洞察的 LLM 接入** — 当前 AI 洞察卡展示通用文案，不做个性化生成
- **主题设置 CSS 变量全局注入** — 当前只做 UI 选择 + 持久化，不实现全局主题切换
- **用户协议/隐私政策页面** — 保持 Toast 占位
- **在线客服集成** — 保持 Toast 占位
- **单元测试/自动化测试框架搭建** — 独立决策

---

## Further Notes

- 后端习惯用 code 0/非0 的响应格式，见 `api-contracts.md` §1.2
- settings 白名单在 `cloudfunctions/focus-api/repositories/user.repo.js` 的 `allowedFields` 数组中，扩展字段时只需加字符串
- 「专注」情绪映射 → 后端 '兴奋'（当前后端情绪集合不含"专注"，用最近正向标签）
- 后端 `EMOTION_TAGS` 常量定义在 `cloudfunctions/focus-api/config/index.js`，如需新增"专注"需同步修改
- 日报详情统计标记 `--` 是因为详情页打开时不发 API 请求，补一个 `statsAPI.today()` 即可，**不需要新后端接口**
