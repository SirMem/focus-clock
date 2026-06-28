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
    sessions: 2,
    currentTask: '📖 复习高数第三章',
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
      { label: '今日专注', value: '1h 15m', icon: '⏱️' },
      { label: '今日番茄', value: '2 个', icon: '🍅' },
    ],
    tabItems: TAB_ITEMS,
    activeTab: 'focus',
    modeColor: MODE_COLORS.focus,
    darkerColor: '#3A7BC8',

    // 导航栏
    capsuleHeight: 44,
    statusBarHeight: 0,
  },

  onLoad() {
    // 获取胶囊位置适配自定义导航
    const sysInfo = wx.getSystemInfoSync();
    const menuInfo = wx.getMenuButtonBoundingClientRect();
    const capsuleHeight = menuInfo.height + (menuInfo.top - sysInfo.statusBarHeight) * 2;

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      capsuleHeight,
      statItems: this._buildStatItems(this.data.sessions),
    });
  },

  // ===== 计时器逻辑 =====
  start() {
    if (this.data.timerState === 'running') return;
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
        return;
      }
      t -= 1;
      const total = DURATIONS[this.data.mode];
      const progress = 1 - t / total;
      this.setData({ timeLeft: t, progress });
    }, 1000);
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
    this.setData({ activeTab: key });
  },

  onTabChange(e) {
    const key = e.detail.value;
    this.setData({ activeTab: key });
  },

  // ===== 工具函数 =====
  _buildStatItems(sessions) {
    return [
      { label: '今日专注', value: '1h 15m', icon: '⏱️' },
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
