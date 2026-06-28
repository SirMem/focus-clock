const TAB_ITEMS = [
  { key: 'focus', label: '专注', icon: 'focus' },
  { key: 'todo', label: '待办', icon: 'task' },
  { key: 'stats', label: '统计', icon: 'chart-bar' },
  { key: 'diary', label: '日记', icon: 'edit-1' },
  { key: 'profile', label: '我的', icon: 'user-avatar' },
];

const INVALID_ID = -1;

const INITIAL_TASKS = [
  { id: 1, text: '复习高数第三章', done: false, pomodoros: 4, completed: 0, priority: 'high' },
  { id: 2, text: 'MySQL 索引优化笔记', done: false, pomodoros: 2, completed: 0, priority: 'medium' },
  { id: 3, text: '完成项目 API 文档', done: false, pomodoros: 3, completed: 0, priority: 'medium' },
  { id: 4, text: 'Redis 缓存策略总结', done: true, pomodoros: 2, completed: 2, priority: 'low' },
  { id: 5, text: 'Spring Security 配置', done: true, pomodoros: 3, completed: 3, priority: 'high' },
  { id: 6, text: '阅读 Vue3 文档', done: false, pomodoros: 1, completed: 0, priority: 'low' },
  { id: 7, text: '整理本周学习笔记', done: false, pomodoros: 2, completed: 0, priority: 'medium' },
];

const PRIORITY_COLORS = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#C0C4CC',
};

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
];

let nextId = 100;

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,
    tabItems: TAB_ITEMS,
    filters: FILTERS,
    hasInput: false,
    tasks: [],
    input: '',
    filter: 'all',
    priorityColors: PRIORITY_COLORS,
    emptyText: '暂无任务，添加一个吧 🎯',
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const statusBarHeight = sys.statusBarHeight || 44;
    // 胶囊高度（模拟）
    const capsuleHeight = 44;
    this.setData({
      statusBarHeight,
      capsuleHeight,
      tasks: this.deepCloneTasks(INITIAL_TASKS),
    }, () => {
      this._updateComputed();
    });
  },

  // ─── 计算属性 ───
  // (WeChat 不支持 getter 用于 WXML，需通过 _updateComputed 手工计算)

  _updateComputed() {
    const { tasks, filter } = this.data;
    const filteredTasks = tasks.filter(t => {
      if (filter === 'all') return true;
      return filter === 'active' ? !t.done : t.done;
    });
    const doneCount = tasks.filter(t => t.done).length;
    const totalFocusMins = tasks.reduce((sum, t) => sum + t.completed * 25, 0);
    const totalHours = Math.floor(totalFocusMins / 60);
    const totalMins = totalFocusMins % 60;

    this.setData({
      filteredTasks,
      doneCount,
      totalHours,
      totalMins,
    });
  },

  // ─── 数据操作 ───

  deepCloneTasks(tasks) {
    return tasks.map(t => ({ ...t }));
  },

  saveTasks(tasks) {
    this.setData({ tasks }, () => {
      this._updateComputed();
    });
  },

  // ─── 事件处理 ───

  onInputChange(e) {
    const val = e.detail.value;
    this.setData({
      input: val,
      hasInput: val.trim().length > 0,
    });
  },

  onAddTask() {
    const text = this.data.input.trim();
    if (!text) return;

    const newTask = {
      id: nextId++,
      text,
      done: false,
      pomodoros: 1,
      completed: 0,
      priority: 'medium',
    };

    const tasks = this.deepCloneTasks(this.data.tasks);
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    this.setData({ input: '' });
  },

  onToggleTask(e) {
    const id = e.currentTarget.dataset.id;
    const tasks = this.deepCloneTasks(this.data.tasks);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === INVALID_ID) return;

    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done };
    this.saveTasks(tasks);
  },

  onDeleteTask(e) {
    const id = e.currentTarget.dataset.id;
    const tasks = this.deepCloneTasks(this.data.tasks);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === INVALID_ID) return;

    wx.showModal({
      title: '删除任务',
      content: `确定删除「${tasks[idx].text}」吗？`,
      success: (res) => {
        if (res.confirm) {
          tasks.splice(idx, 1);
          this.saveTasks(tasks);
        }
      },
    });
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ filter: key }, () => {
      this._updateComputed();
    });
  },

  onFabTap() {
    // 滚动到顶部并聚焦输入框
    this.setData({ input: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  onMenuTap() {
    wx.showActionSheet({
      itemList: ['清空已完成任务', '注销'],
      success: (res) => {
        if (res.tapIndex === 0) {
          const tasks = this.deepCloneTasks(this.data.tasks).filter(t => !t.done);
          this.saveTasks(tasks);
        }
      },
    });
  },

  // ─── Tab 导航 ───

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'todo') return;

    const pageMap = {
      focus: '/pages/focus/focus',
      stats: '/pages/focus/focus',
      diary: '/pages/focus/focus',
      profile: '/pages/focus/focus',
    };

    const url = pageMap[key] || '/pages/focus/focus';
    wx.redirectTo({ url });
  },
});
