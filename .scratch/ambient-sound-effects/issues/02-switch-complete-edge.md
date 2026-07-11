# 02 — 音效切换 + 完成提示音 + 边界场景

**What to build:**

用户在专注过程中点击另一个音效芯片，旧音效淡出停止，新音效淡入开始。计时结束时（番茄/休息完成），背景音淡出停止，播放柔和的「叮」提示音，同时保持现有的震动反馈。跳过当前时段或切换专注/休息模式时，背景音停止。用户切出小程序再回来时（`onShow`），不会意外重播背景音。

**Blocked by:** 01 — 背景音循环播放（基本链路）

**Status:** ready-for-agent

- [ ] `onSoundTap(e)` 中如果 `timerState === 'running'` 且 `currentSound !== 'none'`：调 `_stopAmbient()` 然后调 `_startAmbient()`（播新音效）
- [ ] `onSoundTap(e)` 如果新选择是 `'none'`，仅 `_stopAmbient()` 不启动新音
- [ ] 新建 `_playCompleteSound()`：创建临时 `InnerAudioContext` 播 `complete.mp3`（不循环），播完后 `destroy()` 自清理
- [ ] `_onTimerComplete()` 中先 `_stopAmbient()`，再 `_playCompleteSound()`
- [ ] `skip()` 中调用 `_stopAmbient()`
- [ ] `onModeSwitch(e)` 中调用 `_stopAmbient()`
- [ ] `onShow()` 恢复前台场景：如果计时器还在运行，不自动播放音频（音频上下文不跨页面生命周期，`start()` 中的 `_startAmbient()` 已覆盖正常开始场景）
- [ ] 淡入中被暂停的边界：中断 `_fadeTimer` 并立即反方向开始淡出
- [ ] 手工验收：T5 跳过→背景音停止；T6 切换音效→旧渐弱新渐入；T8 计时结束→叮+震动；T9 切到休息→无音
