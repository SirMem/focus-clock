const sessionAPI = require('../../miniprogram/api/session.api');
const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const coachAPI = require('../../miniprogram/api/coach.api');
const { mapTaskToView, formatDuration } = require('../../miniprogram/api/mappers');

const DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_COLORS = {
  focus: '#4A90D9',
  shortBreak: '#34C759',
  longBreak: '#FF9500',
};

const MODE_LABELS = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
};

const STORAGE_KEY = 'pomodoro_state';

// ===== 音频管理 =====
let _ambientAudio = null;
let _fadeTimer = null;

const SOUND_FILE_MAP = {
  cafe: 'public/sounds/cafe_noise_3min.mp3',
  rain: 'public/sounds/rain.mp3',
  ocean: 'public/sounds/ocean_waves_3min.mp3',
};

const DEFAULT_TIP = '番茄工作法能帮你保持专注，每25分钟全力投入，休息时彻底放松。';

const SOUNDS = [
  { id: 'none', label: '🔇 无音效' },
  { id: 'cafe', label: '☕ 咖啡馆' },
  { id: 'rain', label: '🌧️ 雨声' },
  { id: 'ocean', label: '🌊 海浪' },
];

const TAB_ITEMS = [
  { key: 'focus', label: '专注', icon: 'focus' },
  { key: 'todo', label: '待办', icon: 'task' },
  { key: 'stats', label: '统计', icon: 'chart-bar' },
  { key: 'diary', label: '日记', icon: 'edit-1' },
  { key: 'profile', label: '我的', icon: 'user-avatar' },
  { key: 'coach', label: '教练', icon: 'user-avatar' },
];

Page({
  data: {
    // 计时器状态
    mode: 'focus',
    timerState: 'idle', // idle | running | paused
    timeLeft: DURATIONS.focus,
    progress: 0,
    sessions: 0,
    currentTask: '',
    selectedTaskId: '',
    availableTasks: [],
    showTaskPicker: false,
    currentSound: 'none',
    currentTip: DEFAULT_TIP,
    aiGeneratedBy: '',  // 'ai' | 'rule' | 'fallback'

    // P0-2: 防重复提交
    completing: false,

    // P1-1: 墙钟计时（Date.now() 基准）
    startTime: 0,
    totalSeconds: DURATIONS.focus,
    sessionIdempotencyKey: '',

    // UI 数据
    sounds: SOUNDS,
    modes: [
      { mode: 'focus', label: '专注 25分' },
      { mode: 'shortBreak', label: '休息 5分' },
    ],
    statItems: [
      { label: '今日专注', value: '0m', icon: '⏱️' },
      { label: '今日番茄', value: '0 个', icon: '🍅' },
    ],
    tabItems: TAB_ITEMS,
    activeTab: 'focus',
    modeColor: MODE_COLORS.focus,
    darkerColor: '#3A7BC8',

    // 导航栏
    capsuleHeight: 44,
    statusBarHeight: 0,
  },

  async onLoad() {
    // 获取胶囊位置适配自定义导航
    const sysInfo = wx.getSystemInfoSync();
    const menuInfo = wx.getMenuButtonBoundingClientRect();
    const capsuleHeight = menuInfo.height + (menuInfo.top - sysInfo.statusBarHeight) * 2;

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      capsuleHeight,
    });

    // 加载今日统计和可选任务
    await Promise.all([
      this._loadTodayStats(),
      this._loadAvailableTasks(),
      this._loadCoachData(),
    ]);
  },

  // P1-1: 小程序从后台切回前台时恢复计时器
  onShow() {
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (!saved) return;
    // 如果计时器已经在运行中，不需要恢复
    if (this.data.timerState === 'running') return;
    // 只恢复 running 状态的计时器
    if (saved.status !== 'running') return;

    const now = Date.now();
    const elapsed = Math.floor((now - saved.startTime) / 1000);
    const remaining = Math.max(0, saved.totalSeconds - elapsed);

    wx.removeStorageSync(STORAGE_KEY);

    if (remaining <= 0) {
      // 计时已在后台期间到期
      this.setData({
        timerState: 'idle',
        timeLeft: 0,
        progress: 1,
        mode: saved.mode || this.data.mode,
      });
      wx.vibrateShort({ type: 'medium' });
      this._onTimerComplete(saved.taskId, saved.mode, saved.idempotencyKey);
    } else {
      // 恢复计时
      this.setData({
        startTime: saved.startTime,
        totalSeconds: saved.totalSeconds,
        timeLeft: remaining,
        mode: saved.mode || this.data.mode,
        selectedTaskId: saved.taskId || this.data.selectedTaskId,
        sessionIdempotencyKey: saved.idempotencyKey || '',
        timerState: 'running',
      });
      this._startInterval();
    }
  },

  // ===== 任务选择 =====
  async _loadAvailableTasks() {
    try {
      const res = await taskAPI.list({ isDone: false }, 1, 100);
      if (res.code === 0) {
        const tasks = (res.data.tasks || []).map(mapTaskToView);
        this.setData({ availableTasks: tasks });
        // 如果当前 selectedTaskId 不存在且列表非空，默认选第一个
        const hasSelection = tasks.some(t => t.id === this.data.selectedTaskId);
        if (!hasSelection && tasks.length > 0) {
          this.setData({
            selectedTaskId: tasks[0].id,
            currentTask: tasks[0].text,
          });
        }
      }
    } catch (err) {
      console.error('加载可用任务失败', err);
    }
  },

  // ===== 今日统计 =====
  async _loadTodayStats() {
    try {
      const res = await statsAPI.today();
      if (res.code === 0) {
        const data = res.data || {};
        const pomodoroCount = data.pomodoroCount || 0;
        this.setData({
          sessions: pomodoroCount,
          statItems: [
            { label: '今日专注', value: formatDuration(data.focusMinutes || 0), icon: '⏱️' },
            { label: '今日番茄', value: `${pomodoroCount} 个`, icon: '🍅' },
          ],
        });
      }
    } catch (err) {
      console.error('加载今日统计失败', err);
    }
  },

  // ===== AI 教练卡片 =====
  async _loadCoachData() {
    console.log('[AICard] _loadCoachData 被调用');
    try {
      const res = await coachAPI.smartTip();
      console.log('[AICard] smartTip 返回:', JSON.stringify(res));
      if (res.code === 0 && res.data) {
        this.setData({
          currentTip: res.data.tip,
          aiGeneratedBy: res.data.generatedBy || '',
        });
      }
    } catch (err) {
      console.warn('[AICard] smartTip 调用失败:', err);
      // 保持现有 tip 不变，不崩溃
    }
  },

  // ===== 任务选择器 =====
  async onTaskPickerOpen() {
    await this._loadAvailableTasks();
    this.setData({ showTaskPicker: true });
  },

  onTaskSelect(e) {
    const id = e.currentTarget.dataset.id;
    const task = this.data.availableTasks.find(t => t.id === id);
    if (task) {
      this.setData({
        selectedTaskId: task.id,
        currentTask: task.text,
        showTaskPicker: false,
      });
    }
  },

  // ===== 计时器逻辑（P1-1: 墙钟计时） =====

  /**
   * 启动计时器（开始或恢复）
   *
   * P1-1: 使用 Date.now() 作为时间基准，而非依赖 setInterval 计数。
   * 即使小程序进入后台 setInterval 被降频，切回前台后 onShow 会根据 startTime 重新计算。
   * P0-2: 生成幂等键，防止后端重复写入。
   */
  start() {
    if (this.data.timerState === 'running') return;

    // 如果上轮计时刚结束（timeLeft 为 0），先复位到满时长
    if (this.data.timeLeft <= 0) {
      this.setData({
        timeLeft: DURATIONS[this.data.mode],
        progress: 0,
      });
    }

    // focus 模式必须选择任务才能开始
    if (this.data.mode === 'focus' && !this.data.selectedTaskId) {
      this.onTaskPickerOpen();
      wx.showToast({ title: '请先选择一个待办任务', icon: 'none' });
      return;
    }

    // focus 模式下验证所选任务仍存在（可能被其他端删除）
    if (this.data.mode === 'focus' && this.data.selectedTaskId) {
      const taskExists = this.data.availableTasks.some(t => t.id === this.data.selectedTaskId);
      if (!taskExists) {
        this.setData({ selectedTaskId: '', currentTask: '' });
        wx.removeStorageSync('focus_active_task');
        this.onTaskPickerOpen();
        wx.showToast({ title: '任务已失效，请重新选择', icon: 'none' });
        return;
      }
      // 加锁：标记当前正在专注的任务，阻止待办页误删
      wx.setStorageSync('focus_active_task', this.data.selectedTaskId);
    }

    // P0-2: 生成幂等键（用于本次计时完成后端去重）
    // 只在全新开始（timerState === 'idle'）时生成，暂停恢复时沿用已有 key
    if (this.data.timerState === 'idle') {
      const idempotencyKey = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      this.setData({ sessionIdempotencyKey: idempotencyKey });
    }

    // P1-1: 记录/重置墙钟基准
    const effectiveStart = Date.now();
    const totalSeconds = this.data.timeLeft;

    this.setData({
      startTime: effectiveStart,
      totalSeconds,
      timerState: 'running',
    });

    // 持久化到本地存储，供 onShow 恢复
    wx.setStorageSync(STORAGE_KEY, {
      startTime: effectiveStart,
      totalSeconds,
      mode: this.data.mode,
      status: 'running',
      taskId: this.data.selectedTaskId,
      idempotencyKey: this.data.sessionIdempotencyKey,
    });

    this._startInterval();

    // 启动背景音（非「无音效」时）
    this._startAmbient();
  },

  /**
   * 启动计时器 setInterval（P1-1: 基于 Date.now() 计算剩余时间）
   * @private
   */
  _startInterval() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - this.data.startTime) / 1000);
      const remaining = Math.max(0, this.data.totalSeconds - elapsed);
      const total = this.data.totalSeconds;
      const progress = total > 0 ? (total - remaining) / total : 0;

      this.setData({ timeLeft: remaining, progress });

      if (remaining <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this.setData({ timerState: 'idle', timeLeft: 0, progress: 1 });
        wx.removeStorageSync(STORAGE_KEY);

        // 计时结束震动反馈
        wx.vibrateShort({ type: 'medium' });

        // 记录完成会话（异步，不阻塞 UI）
        this._onTimerComplete(
          this.data.selectedTaskId,
          this.data.mode,
          this.data.sessionIdempotencyKey,
        );
      }
    }, 250); // 每秒 4 次更新，保证秒级精度
  },

  /**
   * 计时完成后调用后端接口
   *
   * P0-2: completing 状态防连点，idempotencyKey 后端去重。
   *
   * @param {string} taskId
   * @param {string} mode
   * @param {string} idempotencyKey
   * @private
   */
  async _onTimerComplete(taskId, mode, idempotencyKey) {
    // 停止背景音并播放完成提示音（在 API 调用前立即执行）
    this._stopAmbient();
    this._playCompleteSound();

    // P0-2: 防重复提交
    if (this.data.completing) return;
    this.setData({ completing: true });

    try {
      const isFocus = mode === 'focus';
      await sessionAPI.complete(mode, DURATIONS[mode], {
        taskId: taskId || null,
        completedPomodoro: isFocus,
        idempotencyKey: idempotencyKey || '',
      });
      // 刷新统计和任务列表
      await Promise.all([
        this._loadTodayStats(),
        this._loadAvailableTasks(),
      ]);
      // 成功完成一轮后刷新 AI 建议
      if (isFocus) {
        this._loadCoachData();
      }
    } catch (err) {
      console.error('Failed to record session', err);
      wx.showToast({ title: '专注记录保存失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ completing: false });
      // 如果新 session 已启动（用户快速重开），不要覆盖新 session 的状态
      if (this.data.timerState !== 'running') {
        this.setData({
          timeLeft: DURATIONS[mode],
          progress: 0,
          sessionIdempotencyKey: '',
        });
        // 解除任务锁定
        wx.removeStorageSync('focus_active_task');
      }
    }
  },

  pause() {
    // 停止背景音（淡出）
    this._stopAmbient();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // P1-1: 暂停时持久化当前状态
    wx.setStorageSync(STORAGE_KEY, {
      startTime: this.data.startTime,
      totalSeconds: this.data.totalSeconds,
      mode: this.data.mode,
      status: 'paused',
      timeLeft: this.data.timeLeft,
      taskId: this.data.selectedTaskId,
      idempotencyKey: this.data.sessionIdempotencyKey,
    });

    this.setData({ timerState: 'paused' });
  },

  reset() {
    // 停止背景音（淡出）
    this._stopAmbient();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync('focus_active_task');
    this.setData({
      timerState: 'idle',
      timeLeft: DURATIONS[this.data.mode],
      progress: 0,
      startTime: 0,
      totalSeconds: DURATIONS[this.data.mode],
      sessionIdempotencyKey: '',
      completing: false,
    });
  },

  skip() {
    // 停止背景音（淡出）
    this._stopAmbient();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync('focus_active_task');
    const nextMode = this.data.mode === 'focus' ? 'shortBreak' : 'focus';
    const color = MODE_COLORS[nextMode];
    this.setData({
      mode: nextMode,
      timerState: 'idle',
      timeLeft: DURATIONS[nextMode],
      progress: 0,
      startTime: 0,
      totalSeconds: DURATIONS[nextMode],
      sessionIdempotencyKey: '',
      completing: false,
      modeColor: color,
      darkerColor: this._adjustColor(color, -15),
    });
  },

  // ===== 事件处理 =====
  onPlayPause() {
    if (this.data.timerState === 'running') {
      this.pause();
    } else {
      this.start();
    }
  },

  onReset() {
    this.reset();
  },

  onSkip() {
    this.skip();
  },

  onModeSwitch(e) {
    const m = e.currentTarget.dataset.mode;
    if (m === this.data.mode) return;
    // 停止背景音（淡出）
    this._stopAmbient();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 切换模式时清除计时状态和任务锁定
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync('focus_active_task');
    const color = MODE_COLORS[m];
    this.setData({
      mode: m,
      timerState: 'idle',
      timeLeft: DURATIONS[m],
      progress: 0,
      startTime: 0,
      totalSeconds: DURATIONS[m],
      sessionIdempotencyKey: '',
      completing: false,
      modeColor: color,
      darkerColor: this._adjustColor(color, -15),
    });
  },

  onSoundTap(e) {
    const id = e.currentTarget.dataset.id;
    // 点击同一个已选中的音效，忽略
    if (id === this.data.currentSound) return;

    this.setData({ currentSound: id });

    // 如果计时器正在运行，实时切换音效
    if (this.data.timerState === 'running') {
      this._stopAmbient();
      if (id !== 'none') {
        this._startAmbient();
      }
    }
  },

  // ===== 音频播放 =====

  /**
   * 根据 currentSound 创建 InnerAudioContext 并循环播放背景音（0.5s 淡入）
   * @private
   */
  _startAmbient() {
    const soundId = this.data.currentSound;
    if (soundId === 'none' || !SOUND_FILE_MAP[soundId]) return;

    // 清理之前的残留音频（如快速重启）
    if (_fadeTimer) {
      clearInterval(_fadeTimer);
      _fadeTimer = null;
    }
    if (_ambientAudio) {
      _ambientAudio.destroy();
      _ambientAudio = null;
    }

    _ambientAudio = wx.createInnerAudioContext();
    _ambientAudio.obeyMuteSwitch = false; // 静音模式下也可播
    _ambientAudio.src = SOUND_FILE_MAP[soundId];
    _ambientAudio.loop = true;
    _ambientAudio.volume = 0;
    _ambientAudio.play();

    // 0.5s 淡入：每 50ms volume += 0.05（10 步 = 500ms）
    let vol = 0;
    _fadeTimer = setInterval(() => {
      vol += 0.05;
      if (vol >= 1) {
        vol = 1;
        clearInterval(_fadeTimer);
        _fadeTimer = null;
      }
      if (_ambientAudio) _ambientAudio.volume = vol;
    }, 50);
  },

  /**
   * 停止背景音（0.5s 淡出 → stop → destroy）
   * @private
   */
  _stopAmbient() {
    // 中断任何正在进行的淡入/淡出
    if (_fadeTimer) {
      clearInterval(_fadeTimer);
      _fadeTimer = null;
    }

    if (!_ambientAudio) return;

    // 0.5s 淡出：每 50ms volume -= 0.05
    let vol = _ambientAudio.volume || 1;
    _fadeTimer = setInterval(() => {
      vol -= 0.05;
      if (vol <= 0) {
        vol = 0;
        clearInterval(_fadeTimer);
        _fadeTimer = null;
        if (_ambientAudio) {
          _ambientAudio.stop();
          _ambientAudio.destroy();
          _ambientAudio = null;
        }
        return;
      }
      if (_ambientAudio) _ambientAudio.volume = vol;
    }, 50);
  },

  /**
   * 播放计时完成提示音（「叮」一声，不循环，播完自销毁）
   * @private
   */
  _playCompleteSound() {
    const ctx = wx.createInnerAudioContext();
    ctx.obeyMuteSwitch = false;
    ctx.src = 'public/sounds/complete.mp3';
    ctx.play();
    ctx.onEnded(() => ctx.destroy());
    ctx.onError(() => ctx.destroy());
  },

  onMenuTap() {
    wx.showToast({ title: '设置', icon: 'none' });
  },


  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    // 当前就在 focus 页，不做操作
    if (key === 'focus') {
      this.setData({ activeTab: key });
      return;
    }
    // 其他 tab → 跳转对应页面
    const pageMap = {
      todo: '/pages/todo/todo',
      diary: '/pages/diary/diary',
      stats: '/pages/stats/stats',
    };
    const url = pageMap[key];
    if (url) {
      wx.redirectTo({ url });
    } else {
      wx.showToast({ title: '开发中...', icon: 'none' });
    }
  },

  onTaskPickerClose() {
    this.setData({ showTaskPicker: false });
  },

  onTabChange(e) {
    const key = e.detail.value;
    this.setData({ activeTab: key });
  },

  // ===== 工具函数 =====
  _buildStatItems(sessions) {
    const focusMinutes = sessions * 25;
    return [
      { label: '今日专注', value: formatDuration(focusMinutes), icon: '⏱️' },
      { label: '今日番茄', value: `${sessions} 个`, icon: '🍅' },
    ];
  },

  _adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  },

  onUnload() {
    // 立即清理音频（不等待淡出完成）
    if (_fadeTimer) {
      clearInterval(_fadeTimer);
      _fadeTimer = null;
    }
    if (_ambientAudio) {
      _ambientAudio.stop();
      _ambientAudio.destroy();
      _ambientAudio = null;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync('focus_active_task');
  },
});
