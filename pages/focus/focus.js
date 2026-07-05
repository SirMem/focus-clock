const sessionAPI = require('../../miniprogram/api/session.api');
const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
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

const AI_TIPS = [
  '番茄工作法能帮你保持专注，每25分钟全力投入，休息时彻底放松。',
  '研究表明，短暂休息能提升大脑效率47%。加油，你做得很棒！',
  '今日已完成3个番茄，专注度比昨天提升了12%。继续保持！',
  '下一个番茄建议专注在最重要的任务上，优先级是成功的关键。',
  '你已连续专注18分钟，坚持就是胜利！休息时记得喝水。',
  '环境整洁能提升专注力。利用休息时间整理一下桌面吧。',
];

const SOUNDS = [
  { id: 'none', label: '🔇 无音效' },
  { id: 'cafe', label: '☕ 咖啡馆' },
  { id: 'rain', label: '🌧️ 雨声' },
  { id: 'ocean', label: '🌊 海浪' },
  { id: 'white', label: '❄️ 白噪音' },
];

const TAB_LABELS = {
  focus: '专注',
  todo: '待办',
  stats: '统计',
  diary: '日记',
  profile: '我的',
  coach: '教练',
};

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
    currentTip: AI_TIPS[0],
    tipIndex: 0,

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
    ]);
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

  // ===== 计时器逻辑 =====
  start() {
    if (this.data.timerState === 'running') return;

    // focus 模式必须选择任务才能开始
    if (this.data.mode === 'focus' && !this.data.selectedTaskId) {
      this.onTaskPickerOpen();
      wx.showToast({ title: '请先选择一个待办任务', icon: 'none' });
      return;
    }

    this.setData({ timerState: 'running' });
    this.timer = setInterval(() => {
      let t = this.data.timeLeft;
      if (t <= 1) {
        clearInterval(this.timer);
        this.timer = null;
        const sessions = this.data.mode === 'focus' ? this.data.sessions + 1 : this.data.sessions;
        const tipIndex = (this.data.tipIndex + 1) % AI_TIPS.length;
        this.setData({
          timerState: 'idle',
          timeLeft: 0,
          progress: 1,
          sessions,
          statItems: this._buildStatItems(sessions),
          currentTip: AI_TIPS[tipIndex],
          tipIndex,
        });
        // 计时结束震动反馈
        wx.vibrateShort({ type: 'medium' });

        // 记录完成会话并刷新数据
        this._onTimerComplete();
        return;
      }
      t -= 1;
      const total = DURATIONS[this.data.mode];
      const progress = 1 - t / total;
      this.setData({ timeLeft: t, progress });
    }, 1000);
  },

  async _onTimerComplete() {
    try {
      const mode = this.data.mode;
      const isFocus = mode === 'focus';
      await sessionAPI.complete(mode, DURATIONS[mode], {
        taskId: this.data.selectedTaskId || null,
        completedPomodoro: isFocus,
      });
      // 刷新统计和任务列表
      await Promise.all([
        this._loadTodayStats(),
        this._loadAvailableTasks(),
      ]);
    } catch (err) {
      console.error('Failed to record session', err);
    }
  },

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setData({ timerState: 'paused' });
  },

  reset() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setData({
      timerState: 'idle',
      timeLeft: DURATIONS[this.data.mode],
      progress: 0,
    });
  },

  skip() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const nextMode = this.data.mode === 'focus' ? 'shortBreak' : 'focus';
    const color = MODE_COLORS[nextMode];
    this.setData({
      mode: nextMode,
      timerState: 'idle',
      timeLeft: DURATIONS[nextMode],
      progress: 0,
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const color = MODE_COLORS[m];
    this.setData({
      mode: m,
      timerState: 'idle',
      timeLeft: DURATIONS[m],
      progress: 0,
      modeColor: color,
      darkerColor: this._adjustColor(color, -15),
    });
  },

  onSoundTap(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ currentSound: id });
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
});
