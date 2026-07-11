# 14-diary-full — Diary 页面完整实现（Write + History + Detail 三视图）

> 状态: 📋 待实现
> 设计参考: `Figma/src/app/components/DiaryScreen.tsx`
> 依赖: `docs/api-contracts.md` §5, `docs/dev-specs/frontend-v2/06-diary.md`
> 契约: 后端 `diary/create|list|update|delete` 完整可用

---

## Problem Statement

当前日记页面（`pages/diary/`）仅实现了"写日记"的雏形，与 Figma 设计稿存在显著差距：

1. **样式未对齐** — 情绪选择器是矩形卡片而非 Figma 的圆形按钮；日期头缺少已完成番茄数副标题；最大字数限于 500 而非设计稿的 2000
2. **"查看全部"是空壳** — 点击"查看全部"仅弹出 toast，没有筛选/浏览历史记录的完整页面
3. **无日记详情页** — 点击历史条目仅弹出简陋的 `wx.showModal`，看不到情绪统计、AI 洞察、关联任务、上下篇导航
4. **无日记路由** — 其他页面（focus）的 Tab 无法跳转到 diary 页

用户需要一个完整的日记模块，支持"写→浏览→查看详情"的闭环体验。

---

## Solution

基于 Figma 设计稿（`Figma/src/app/components/DiaryScreen.tsx`）的完整三视图架构，将日记页面改写为视图路由模式：

```
DiaryScreen（同一 Page 内用 wx:if 切换视图）
  ├── 📝 WriteView    — 写日记（增强现有实现）
  ├── 📚 HistoryView  — 全部日记 + 筛选（新功能）
  └── 📖 DetailView   — 日记详情 + AI 洞察（新功能）
```

每个视图独立实现，通过 `data.view` 状态切换，不新增页面文件。

---

## User Stories

1. 作为一个用户，我想**看到今日日期 + 已完成番茄数**，以便快速了解当日的专注概况
2. 作为一个用户，我想**通过圆形表情按钮选择情绪**，以便快速标记当天心情
3. 作为一个用户，我希望能**看到 AI 引导思考的问题**，以便获得写作灵感
4. 作为一个用户，我想**在输入框中写日记**，以便记录当天的感受和反思
5. 作为一个用户，我想看到**已完成的今日任务摘要**，以便在写日记时回顾完成的工作
6. 作为一个用户，我想**点击保存按钮保存日记**，以便持续记录自己的专注历程
7. 作为一个用户，我想看到**最近的历史记录条目**，以便快速翻阅近期日记
8. 作为一个用户，我想**点击"查看全部"进入完整历史页**，以便浏览全部日记
9. 作为一个用户，我想**按日期筛选日记**（全部/本周/本月/上月/自定义），以便缩小查看范围
10. 作为一个用户，我想**按情绪筛选日记**（点选表情即可），以便根据心情回顾特定时期
11. 作为一个用户，我想看到**筛选后的结果按月分组**，以便按时间脉络浏览
12. 作为一个用户，我想**点击筛选标签旁边的清除按钮**取消筛选，以便快速回到全部视图
13. 作为一个用户，我想**点击某篇日记进入详情页**，以便看到完整的日记内容和数据
14. 作为一个用户，我想在详情页看到**情绪 + 日期 + 番茄数/专注时长/完成任务数**汇总，以便一目了然地回顾
15. 作为一个用户，我想在详情页看到**日记的完整正文**，以便重温当天的记录
16. 作为一个用户，我想在详情页看到**当日完成的任务列表**，以便回顾当天做了什么
17. 作为一个用户，我想在详情页看到**AI 教练洞察**，以便获得 AI 对当天数据的解读
18. 作为一个用户，我想在详情页**上下篇切换日记**，以便连续翻阅邻近日期的记录
19. 作为一个用户，我想从详情页**点击返回回到之前的视图**（Write 或 History），以便继续其他操作

---

## BDD Scenarios

### Feature: 写日记 (WriteView)

```
Scenario: 进入日记页显示写日记视图
  Given 用户打开日记页
  Then 显示写日记视图
  And 显示今日日期和"已完成 X 个番茄"副标题
  And 显示 5 个表情按钮（😊 😐 😢 😤 🧘）
  And 显示 AI 引导卡片
  And 显示空的文本输入框（placeholder "记录今天的感受、收获和反思..."）
  And 显示已完成的今日任务摘要卡片
  And 显示灰色的"保存今日记录"按钮（禁用态）
  And 显示最近 3 条历史记录条目
  And 底部有"查看全部 →"链接

Scenario: 选择情绪
  Given 在写日记视图
  When 点击"😊 开心"表情按钮
  Then "😊 开心"按钮显示蓝色选中边框和阴影
  And 其他按钮取消选中状态

Scenario: 输入内容
  Given 在写日记视图
  When 在文本框中输入文字
  Then 字数统计实时更新
  And 当字数超过 1800（90%）时计数变为橙色
  And 当内容不为空时"保存今日记录"按钮变为蓝色渐变可用态

Scenario: 保存日记
  Given 在写日记视图，已输入内容并选择了情绪
  When 点击"保存今日记录"按钮
  Then 调用 diaryAPI.create({ content, emotionTags, tasks })
  And 保存成功后显示 toast "保存成功"
  And 清空输入框内容
  And 重置字数统计
  And 刷新历史记录列表

Scenario: 拍照按钮
  Given 在写日记视图
  When 点击 📷 按钮
  Then toast "拍照功能开发中，敬请期待"

Scenario: 语音按钮
  Given 在写日记视图
  When 点击 🎤 按钮
  Then toast "语音输入开发中，敬请期待"
```

### Feature: 历史记录 (HistoryView)

```
Scenario: 进入历史记录视图
  Given 在写日记视图
  When 点击"查看全部 →"
  Then 切换到历史记录视图
  And 顶部栏显示"全部日记"和总篇数
  And 显示返回按钮
  And 显示日期筛选标签组（全部/本周/本月/上月/自定义）
  And 显示情绪筛选表情按钮组

Scenario: 按日期筛选—本周
  Given 在历史记录视图
  When 点击"本周"日期筛选标签
  Then 历史列表仅显示本周内的日记
  And 顶部出现已筛选标签"本周"（可清除）
  And 日期筛选标签"本周"高亮为蓝色

Scenario: 按日期筛选—上月
  Given 在历史记录视图
  When 点击"上月"日期筛选标签
  Then 历史列表仅显示上个月的日记
  And 顶部出现已筛选标签

Scenario: 按日期筛选—自定义
  Given 在历史记录视图
  When 点击"自定义"日期按钮
  Then 展开日历选择器弹出层
  When 点击某个日期
  Then 选择器收起
  And 历史列表更新为仅显示该日期范围的日记

Scenario: 按情绪筛选
  Given 在历史记录视图
  When 点击某个表情按钮（如 😊）
  Then 表情按钮高亮并显示情绪名称标签
  And 历史列表仅显示该情绪的日记
  And 顶部出现已筛选标签

Scenario: 清除单个筛选
  Given 在历史记录视图，已有周期间和情绪筛选
  When 点击已筛选标签上的 × 按钮
  Then 该筛选条件被移除
  And 历史列表更新

Scenario: 清除全部筛选
  Given 在历史记录视图，已有筛选条件
  When 点击空态中的"清除筛选"按钮
  Then 所有筛选条件被重置为"全部"

Scenario: 无匹配结果
  Given 在历史记录视图，筛选条件导致无匹配
  Then 显示空态：🔍 + "没有符合条件的记录" + "清除筛选"按钮

Scenario: 按月分组显示
  Given 在历史记录视图，有多条日记
  Then 日记按月份分组显示
  And 每组显示月份标题（如"2026年6月"）
  And 月份标题旁有篇数 badge
  And 每组下方有分隔线
  And 每条日记卡片显示情绪图标、日期、周几、🍅 数、预览文本

Scenario: 从历史记录进入详情
  Given 在历史记录视图
  When 点击某条日记卡片
  Then 进入日记详情视图
  And 默认从详情页返回时回到历史记录视图

Scenario: 返回写日记
  Given 在历史记录视图
  When 点击返回按钮
  Then 回到写日记视图
```

### Feature: 日记详情 (DetailView)

```
Scenario: 查看日记详情
  Given 打开某篇日记的详情视图
  Then 顶部栏显示日记日期和周几
  And 显示返回按钮
  And 显示上/下篇导航按钮（根据是否有前/后篇决定可用态）
  And Hero 区显示情绪图标、情绪标签、日期、周几
  And Hero 区显示三指标统计（🍅 番茄数 / ⏱ 专注时长 / ✅ 完成任务数）
  And 显示"今日记录"正文（按段落分段展示）
  And 显示"当日任务"列表（每个任务带勾选框 + 时长）
  And 显示"AI 教练洞察"卡片（渐变背景）
  And 底部显示上/下篇导航卡片

Scenario: 详情页—返回写日记
  Given 从写日记视图进入详情页
  When 点击返回按钮
  Then 回到写日记视图

Scenario: 详情页—返回历史记录
  Given 从历史记录视图进入详情页
  When 点击返回按钮
  Then 回到历史记录视图

Scenario: 详情页—切换到上/下一篇
  Given 在详情页，当前日记有上/下一篇
  When 点击"上一篇"或"下一篇"按钮
  Then 切换到对应的日记详情
  And 顶部栏日期更新
  And 所有内容区刷新为新的日记数据

Scenario: 详情页—向前翻到尽头
  Given 在详情页查看最早的日记
  Then "上一篇"按钮不可用（半透明）
  When 点击"上一篇"
  Then 无反应

Scenario: 详情页—向后翻到尽头
  Given 在详情页查看最新的日记
  Then "下一篇"按钮不可用（半透明）
  When 点击"下一篇"
  Then 无反应
```

---

## Implementation Decisions

### 1. 视图路由 — Single Page 三视图

不新增 Mini Program 页面文件，而是在 `pages/diary/diary.js` 中用 `data.view` 状态切换三个视图：

```javascript
// 视图状态机
type View = 'write' | 'history' | 'detail';

data: {
  view: 'write',       // 当前视图
  prevView: 'write',   // 记录来自哪个视图（用于 detail → back）
  // ...
}
```

- 三个视图使用 `wx:if="{{view === 'write'}}"` / `wx:if="{{view === 'history'}}"` / `wx:if="{{view === 'detail'}}"` 切换
- `prevView` 记录进入 detail 之前的视图，点击返回时恢复

### 2. 情绪模型更新

Figma 设计稿使用 `🧘 专注` 替代当前的 `🤩 兴奋`：

```javascript
// 新情绪列表（Figma 对齐）
EMOTIONS = [
  { emoji: '😊', label: '开心', id: 'happy' },
  { emoji: '😐', label: '平静', id: 'calm' },
  { emoji: '😢', label: '沮丧', id: 'sad' },
  { emoji: '😤', label: '焦虑', id: 'anxious' },
  { emoji: '🧘', label: '专注', id: 'focused' },
];
```

需要同步更新 `mappers.js` 中的 `mapEmotionToCanonical` 和 `mapCanonicalToEmotion`，但注意后端 API 契约的 `emotionTags` 合法值目前不包含"专注"。有两种方案：
- **方案 A（推荐）**：将 `focused` 映射为 `'平静'`（最接近的现有情绪）发送到后端，展示时转换为 `🧘 专注`
- **方案 B**：将 `focused` 映射为 `'兴奋'` 发送（两标签语义相近——都是正向积极情绪），展示时显示 `🧘 专注`

### 3. 日期筛选——前端本地计算

日记列表 API（`diary/list`）仅支持 `date` 单日筛选和 `emotionTag` 单标签筛选，不支持 `startDate/endDate` 范围查询。因此：
- 历史页面的日期筛选（本周/本月/上月）采用**前端本地计算**
- `onLoad` 时调用 `diaryAPI.list({ pageSize: 200 })` 获取全量记录
- 前端用 JavaScript 根据筛选条件过滤 `historyEntries`
- 自定义日期使用同样的前端过滤逻辑

### 4. 详情页数据——本地聚合

详情页使用的数据（番茄数、专注时长、关联任务、AI 洞察）当前后端 `diary/list` 不直接返回。实现方式：
- **P0 方案**：详情页仅展示已有后端字段（`content`, `emotionTags`, `createdAt`）
- 番茄数/专注时长暂时显示占位符 `--`，或通过 `stats/today` 聚合
- 关联任务通过 `tasks` 字段的 `_id` 列表另行查询（可选）
- AI 洞察暂不展示（或复用 focus 页已有的 AI tip 数据）

### 5. 样式对齐——Figma 设计 tokens

情绪选择器由"矩形 + 蓝色透明边框"改为：

```
圆形按钮样式:
- 尺寸: 80rpx × 80rpx
- emoji 字体: 40rpx
- 未选中: 背景 #F5F7FA, 无边框
- 选中态: 背景 #fff, 3rpx 实线边框 #4A90D9, 阴影 0 8rpx 32rpx rgba(74,144,217,0.2)
- 标签文字: 未选中 #C0C4CC, 选中 #4A90D9

注意: Figma 设计稿中 5 个按钮 flex 均匀分布 (justify-content: space-between)
```

### 6. 数据加载策略

```
WriteView → onLoad:
  并行: diaryAPI.list({ pageSize: 50 })  → historyEntries
        taskAPI.list({ isDone: true })    → todayTasks（已完成任务摘要）
        statsAPI.today()                  → todayStats（今日番茄数）

HistoryView → 进入时:
  复用 WriteView 已加载的 historyEntries（不做重复请求）

DetailView → 进入时:
  使用条目本身的本地数据（已包含在 historyEntries 中）
```

### 7. maxChars: 500 → 2000

对齐 Figma 设计稿，最大字符数从 500 提升到 2000。

### 8. 底部 Tab 导航集成

在 `focus.js` 的 `pageMap` 中添加 diary 路由映射：
```javascript
const pageMap = {
  todo: '/pages/todo/todo',
  diary: '/pages/diary/diary',  // 新增
};
```

同时在 `pages/diary/diary.js` 中实现 `onTabTap` 处理底部 Tab 跳转（如果后续添加了 Tab 栏时）。

---

## Testing Decisions

### 测试策略

本项目无测试框架，但 BDD 场景本身作为验收条件。建议在 PR 描述中逐条勾选 BDD 场景来验证实现完整性。

### 前端的可测试性设计

1. **视图切换** — 通过 `data.view` 一个状态控制三个视图的显隐，切换视图只需 `setData({ view })`
2. **数据过滤** — 筛选逻辑集中在 `_filterEntries(filterDate, filterEmotion)` 一个纯函数中，便于未来单元测试
3. **情绪映射** — 所有情绪映射集中在 `mappers.js`，不散落在页面逻辑中

### 手动测试 checklist

见 BDD Scenarios 列表，每个 Scenario 的前置条件 + 操作 + 预期结果构成验收标准。

---

## Out of Scope

- 📷 拍照上传（P0 不做，保留 `onPhotoTap` toast）
- 🎤 语音输入（P0 不做，保留 `onVoiceTap` toast）
- 日记编辑/删除（P1，当前只支持创建和查看）
- 日记详情页的 AI 洞察真实数据（需要后续对接 `coach/score` 接口）
- 日记详情页的关联任务展开（关联 `taskAPI.get`）
- 后端 `diary/list` 支持 `startDate/endDate` 范围查询
- 底部的全局 Tab 栏（需要统一各页面的导航方案，超出本 spec 范围）
- 数据持久化缓存（如 wx.setStorage）

---

## Further Notes

### 现有代码保护

- `diary.wxss` 中已有的样式应保留并微调，而非全部重写
- `diary.js` 中已有的 API 集成代码（`_loadEntries`, `_loadTodaySummary`, `onSave`）应保留，仅增加视图路由和筛选逻辑
- `mappers.js` 中的映射函数不可破坏向后兼容

### 设计中未明确但需要决定的事项

- 情绪按钮的「专注」发送到后端应映射为哪个 canonical 标签 → 建议映射为 `'平静'`（前端显示 `🧘 专注`）
- 详情页待任务的 `duration` 字段当前后端不返回，应显示 `--min` 或通过 taskAPI 查询
- 未设置边界情况下，自定义日历选择器建议简化：不实现完整日历组件，改为两个 picker（开始日期 + 结束日期）

### 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `pages/diary/diary.js` | ✏️ 重构 | 视图路由 + History 筛选 + Detail 数据组装 |
| `pages/diary/diary.wxml` | ✏️ 重构 | 三视图模板（用 wx:if 组织） |
| `pages/diary/diary.wxss` | ✏️ 追加 | 新视图样式（圆形情绪按钮、详情页卡片等） |
| `miniprogram/api/mappers.js` | ✏️ 小改 | `mapEmotionToCanonical` 增加 `focused` → `'平静'` 映射 |
| `pages/focus/focus.js` | ✏️ 小改 | `pageMap` 添加 `diary: '/pages/diary/diary'` |

### 视图状态流转图

```
                    ┌──────────┐
                    │  Write   │
                    │  (默认)   │
                    └────┬─────┘
                         │
           点击"查看全部"│    点击返回
                         ▼
                    ┌──────────┐
               ┌───▶│ History  │◀───┐
               │    └────┬─────┘    │
               │         │          │
    点击返回    │   点击条目│          │ 点击条目
               │         ▼          │
               │    ┌──────────┐    │
               └────│  Detail  │────┘
                    └──────────┘
                        │   ↕
                   上/下篇翻页
                   （不改变 prevView）
```
