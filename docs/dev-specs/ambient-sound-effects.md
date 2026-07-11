# Spec: 专注页背景音效

> 状态: 📝 待实现 · 目标版本: v1.4.0
> 最后更新: 2026-07-11

---

## Problem Statement

专注页的计时器 UI 中已存在音效选择器（4 个可点击的芯片按钮：无音效、咖啡馆、雨声、海浪），当前该选择器仅更新选中态（`currentSound` 的 `setData`），**没有任何音频播放功能**。用户选择「雨声」后开始专注，雨声并未响起；计时结束也只有震动，没有铃声提示。

另外，用户已准备好音频文件（咖啡馆·海浪·雨声·完成提示铃），存放在 `public/sounds/` 中，均为 mp3 格式。

---

## Solution

在专注页 `focus.js` 中增加音频播放管理层，以 `wx.createInnerAudioContext()` 为核心 API，实现：
1. 用户选择非 "none" 的音效后，开始专注时自动循环播放对应的背景音
2. 暂停/重置/模式切换时自动停止背景音
3. 计时结束（番茄完成）时播放短促的完成提示音 + 保持现有震动
4. 切换音效时无缝停止旧音、播放新音
5. 0.5 秒的淡入淡出过渡（通过音频 gain 渐变更合理，但 `InnerAudioContext` 不直接支持音量渐变；采取 **`wx.createAudioContext` 配合 volume 定时递增/递减**的方案近似实现）

### 链路模型

```
用户 tap 音效芯片
    ↓
onSoundTap(e) → setData({ currentSound })
    ↓
开始计时 (start())
    ↓
_startAmbient() → wx.createInnerAudioContext()
    ↓
设置 src = sounds/cafe.mp3 → loop = true → play()
    ↓
淡入：setInterval 每 50ms volume += 0.05 → 直至 volume = 1

暂停 (pause())
    ↓
_stopAmbient() → 淡出 → audio.stop() → audio.destroy()

计时结束 (_onTimerComplete)
    ↓
_stopAmbient() → _playComplete() → create 临时音频 → complete.mp3 播一次
```

---

## User Stories

1. 作为专注用户，我可以在专注页的音效芯片中选择一种背景音（咖啡馆/雨声/海浪），以便在专注时段听到舒缓的氛围音效。
2. 作为专注用户，我选择「无音效」后开始专注，全程不会播放任何背景音。
3. 作为专注用户，我开始专注后，所选音效自动开始循环播放。
4. 作为专注用户，我暂停专注时，背景音也随之暂停。
5. 作为专注用户，我恢复专注时，背景音从暂停处继续播放。
6. 作为专注用户，我重置/跳过专注时，背景音停止。
7. 作为专注用户，我在专注中切换音效，旧音效停止，新音效立即开始播放。
8. 作为专注用户，我从专注模式切换到休息模式时，背景音自动停止。
9. 作为专注用户，我完成一个番茄后，听到柔和的「叮」一声提示，同时手机震动。
10. 作为专注用户，我完成番茄后，背景音自动停止，完成提示音短暂响起后即结束。
11. 作为专注用户，我切出小程序再回来，如果计时器在后台继续走，背景音不会在恢复前台后意外播放（由 `onShow` 的恢复逻辑约束）。
12. 作为开发者，音频上下文在页面卸载时被正确清理，不造成内存泄漏。

---

## Implementation Decisions

### 1. 音频文件处理

| 文件 | 格式 | 说明 |
|------|------|------|
| `cafe_noise_3min.mp3` | mp3 | 咖啡馆背景音 |
| `ocean_waves_3min.mp3` | mp3 | 海浪背景音 |
| `rain.mp3` | mp3 | 雨声背景音 |
| `complete.mp3` | mp3 | 计时完成提示音 |

**文件位置**：统一放在 `public/sounds/` 目录下。

**⚠️ WebM 转码**：微信小程序 `InnerAudioContext` 支持的音频格式为 `mp3` / `aac` / `m4a` / `wav`，不支持 WebM。需将 `.webm` 文件转码为 `.mp3`。转码工具推荐：
- **FFmpeg**（全平台）：`ffmpeg -i cafe_noise_3min.webm -acodec libmp3lame -b:a 128k assets/sounds/cafe.mp3`
- 在线转换工具亦可

### 2. 音频播放 API

选用 `wx.createInnerAudioContext()`，原因：
- 支持循环播放（`loop: true`）
- 支持后台播放（小程序切后台时音频继续）
- 支持 `volume` 属性（0–1）用于淡入淡出
- 支持 `stop()`、`destroy()` 完全释放资源

不使用 `wx.createAudioContext()`（需绑定 WXML `<audio>` 标签，页面结构侵入大）。

### 3. 淡入淡出策略

| 场景 | 效果 | 实现 |
|------|------|------|
| 开始专注或切换音效 | 0.5s 淡入 | `setInterval(50ms)`: `volume += 0.05` 从 0 → 1（共 10 步 × 50ms = 500ms） |
| 暂停/重置/计时结束 | 0.5s 淡出 | `setInterval(50ms)`: `volume -= 0.05` 从 1 → 0 → `stop()` |

**边界情况**：如果在淡入过程中用户又暂停，应中断淡入的 interval 并立即开始淡出。

### 4. 音频实例管理

使用模块级变量（而非 `this.data`），因为 `InnerAudioContext` 不是可序列化的数据：

```js
// focus.js 顶部（模块作用域）
let _ambientAudio = null;   // 背景音实例
let _fadeTimer = null;      // 淡入淡出定时器

// 播放完成提示音用独立的临时实例（不循环）
function _playCompleteSound() {
  const ctx = wx.createInnerAudioContext();
  ctx.src = 'assets/sounds/complete.mp3';
  ctx.play();
  ctx.onEnded(() => ctx.destroy()); // 播完自动释放
}
```

### 5. 触发映射

| 用户操作 | 方法 | 音频行为 |
|---------|------|---------|
| 点击音效芯片 | `onSoundTap(e)` | 切 `currentSound`；若计时运行中 → 停止旧音 → 播新音 |
| 开始专注 | `start()` | 若 `currentSound !== 'none'` → 启动背景音（淡入） |
| 暂停专注 | `pause()` | 停止背景音（淡出） |
| 恢复专注 | `start()`（`timerState === 'paused'`） | 若 `currentSound !== 'none'` → 启动背景音（淡入） |
| 重置/跳过 | `reset()` / `skip()` | 停止背景音（淡出） |
| 切换模式 | `onModeSwitch(e)` | 停止背景音（淡出） |
| 计时完成 | `_onTimerComplete()` | 停止背景音 → 播放完成提示音 |
| 页面卸载 | `onUnload()` | 清理所有音频实例 |

### 6. 音频文件映射

```js
// focus.js
const SOUND_FILE_MAP = {
  cafe: 'public/sounds/cafe_noise_3min.mp3',
  rain: 'public/sounds/rain.mp3',
  ocean: 'public/sounds/ocean_waves_3min.mp3',
};
```

### 7. 不修改的文件

- `focus.wxml` — 音效芯片 UI 已完整，无需改动
- `focus.wxss` — 音效芯片样式已完整，无需改动
- `components/circular-timer/*` — 不受影响
- `miniprogram/api/*` — 不受影响
- 后端（`cloudfunctions/`）— 不受影响

---

## Testing Decisions

### 测试策略

专注页音效的测试以**行为验证**为主，而非实现细节。由于微信小程序运行时环境依赖，此功能最适合：

1. **WeChat DevTools 手工验收** — 主验证手段
2. **代码审查** — 确认音频生命周期正确（创建→播放→停止→销毁）

### 手工验收清单

| 编号 | 测试场景 | 预期结果 |
|------|---------|---------|
| T1 | 选择「雨声」→ 点开始 | 雨声从静音渐强至正常音量，循环播放 |
| T2 | 运行中点「暂停」 | 背景音渐弱至停止 |
| T3 | 暂停后点「继续」 | 背景音渐强恢复 |
| T4 | 点「重置」 | 背景音停止 |
| T5 | 运行中点「跳过」 | 背景音停止，进入下一模式 |
| T6 | 播放中选择不同音效 | 旧音效停止，新音效渐入 |
| T7 | 选择「无音效」开始 | 全程无音频 |
| T8 | 计时结束 | 背景音淡出，播放「叮」提示音，手机震动 |
| T9 | 切到休息模式 | 无背景音 |
| T10 | 页面卸载后重进 | 无音频残留 |
| T11 | 音效芯片选中态高亮（回归） | 选中项显示蓝色边框 + 白色背景 |

### 单元测试

当前项目无测试框架。若将来引入测试：
- 可将音频管理逻辑抽取为独立模块（如 `services/audio.service.js`），针对其状态机编写单元测试
- 测试边界：无音效 → 有音效切换、快速连续切换、淡入中被暂停

---

## Out of Scope

- **Profile 页音效总开关** — 决定暂不加，专注页独立控制即可
- **音量滑块** — 跟随系统媒体音量，不添加应用内音量调节 UI
- **音效下载/管理页面** — 音频文件随包发布，不提供在线下载或自定义音效上传
- **休息模式背景音** — 休息时无背景音（专注结束的提示音播完即止）
- **后台音频控制** — 不实现锁屏控制条/通知栏音频控制
- **跨设备音效设置同步** — 音效偏好仅存本地，不存云端

---

## Further Notes

### 代码改动量估计

| 文件 | 改动类型 | 行数 |
|------|---------|------|
| `pages/focus/focus.js` | ✏️ 修改 | 新增约 90 行（音频管理 + 触发集成），修改约 10 行（在现有方法中插播调用） |
| `assets/sounds/*.mp3` | ✨ 新增 | 4 个 mp3 文件（需转换后移入） |
| `pages/focus/focus.wxml` | ✅ 无改变 | — |
| `pages/focus/focus.wxss` | ✅ 无改变 | — |
