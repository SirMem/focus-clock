# 01 — 背景音循环播放（基本链路）

**What to build:**

用户在专注页选择一种非「无音效」的背景音后开始计时，所选音效以循环模式播放，伴随 0.5 秒淡入。暂停计时时背景音以 0.5 秒淡出停止，恢复计时时淡入续播。重置计时或页面卸载时背景音停止并释放音频资源。音效芯片的选中态高亮保持不变（回归验证）。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 新建 `_startAmbient()` 方法：创建 `InnerAudioContext`，设 `src`（按 `currentSound` 从 `SOUND_FILE_MAP` 取值）、`loop: true`，以 0.5s 淡入（`volume` 每 50ms +0.05 从 0→1）后播放
- [ ] 新建 `_stopAmbient()` 方法：以 0.5s 淡出（`volume` 每 50ms -0.05 从 1→0），完成后调用 `stop()` + `destroy()`
- [ ] `start()` 中非 `'none'` 音效启动后调用 `_startAmbient()`
- [ ] `pause()` 中调用 `_stopAmbient()`
- [ ] `reset()` 中调用 `_stopAmbient()`
- [ ] `onUnload()` 中清理音频实例
- [ ] 模块级变量 `_ambientAudio` / `_fadeTimer` 管理音频生命周期
- [ ] 切换音效、跳过、模式切换**不做**（留给 Ticket 02）
- [ ] `SOUNDS` 数组去掉 `white` 条目，保留 `none` / `cafe` / `rain` / `ocean`
- [ ] 手工验收：T1 选雨声→开始→听到循环雨声（淡入）；T2 暂停→渐弱停止；T3 恢复→渐入续播；T4 重置→停止；T10 卸载重进→无音频残留；T11 芯片选中态高亮回归
- [ ] 选择「无音效」后开始，全程无音频播放
