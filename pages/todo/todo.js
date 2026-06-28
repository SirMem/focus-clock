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

  onReady() {
    // 页面就绪后，延迟触发首个任务的"轻推"提示动画
    this._hintTimer = setTimeout(() => this._doSwipeHint(), 1200);
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

  // ─── 滑动删除手势 ───

  onTouchStart(e) {
    const touch = e.touches[0];
    this._swipeStartX = touch.clientX;
    this._swipeStartY = touch.clientY;
    this._swipeStartTime = Date.now();
    this._swipingId = e.currentTarget.dataset.id;

    // 关闭过渡动画，手指跟手
    this._setSwipeProp(this._swipingId, '_swipeNoTrans', true);
  },

  onTouchMove(e) {
    if (!this._swipingId) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - this._swipeStartX;
    const deltaY = touch.clientY - this._swipeStartY;

    // 竖向滑动为主 → 不处理（让 scroll-view 正常滚动）
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) return;

    const maxSwipe = 180;
    const swipeX = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
    const swipePct = Math.min(1, Math.abs(swipeX) / maxSwipe);

    this._setSwipeProp(this._swipingId, '_swipeX', swipeX);
    this._setSwipeProp(this._swipingId, '_swipePct', swipePct);
  },

  onTouchEnd() {
    if (!this._swipingId) return;
    const id = this._swipingId;
    this._swipingId = null;

    const tasks = this.data.tasks;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const absSwipe = Math.abs(task._swipeX || 0);
    const swipeX = task._swipeX || 0;

    if (absSwipe < 10) {
      // 轻点 → 切换完成状态
      this._resetSwipeState(id);
      this._toggleTaskById(id);
    } else if (absSwipe > 80) {
      // 超过阈值 → 飞出后删除
      const flyDir = swipeX > 0 ? 1 : -1;
      this._setSwipeProp(id, '_swipeNoTrans', false);
      this._setSwipeProp(id, '_swipeX', flyDir * 400);
      this._setSwipeProp(id, '_swipePct', 1);
      setTimeout(() => this._deleteTaskById(id), 300);
    } else {
      // 未达阈值 → 弹回
      this._resetSwipeState(id);
    }
  },

  // ─── 保留原有事件处理（兼容入口） ───

  onToggleTask(e) {
    this._toggleTaskById(e.currentTarget.dataset.id);
  },

  onDeleteTask(e) {
    this._deleteTaskById(e.currentTarget.dataset.id, true);
  },

  // ─── 内部辅助方法 ───

  _setSwipeProp(id, prop, value) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const update = { [`tasks[${idx}].${prop}`]: value };
    // 同步更新 filteredTasks 路径，确保 WXML 重绘
    const fidx = this.data.filteredTasks.findIndex(t => t.id === id);
    if (fidx !== -1) {
      update[`filteredTasks[${fidx}].${prop}`] = value;
    }
    this.setData(update);
  },

  _resetSwipeState(id) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const update = {
      [`tasks[${idx}]._swipeNoTrans`]: false,
      [`tasks[${idx}]._swipeX`]: 0,
      [`tasks[${idx}]._swipePct`]: 0,
    };
    // 同步更新 filteredTasks 路径
    const fidx = this.data.filteredTasks.findIndex(t => t.id === id);
    if (fidx !== -1) {
      update[`filteredTasks[${fidx}]._swipeNoTrans`] = false;
      update[`filteredTasks[${fidx}]._swipeX`] = 0;
      update[`filteredTasks[${fidx}]._swipePct`] = 0;
    }
    this.setData(update);
  },

  _toggleTaskById(id) {
    const tasks = this.deepCloneTasks(this.data.tasks);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], done: !tasks[idx].done };
    this.saveTasks(tasks);
  },

  _deleteTaskById(id, showConfirm) {
    const tasks = this.deepCloneTasks(this.data.tasks);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    if (showConfirm) {
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
    } else {
      tasks.splice(idx, 1);
      this.saveTasks(tasks);
    }
  },

  // ─── 首卡轻推提示动画 ───

  _doSwipeHint() {
    const tasks = this.data.filteredTasks;
    if (!tasks || tasks.length === 0) return;
    const id = tasks[0].id;
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    // 先让提示渐变闪烁
    this.setData({
      [`tasks[${idx}]._hintDone`]: false,
    });

    // 短延迟后轻推（向左滑 35rpx）
    setTimeout(() => {
      this.setData({
        [`tasks[${idx}]._swipeNoTrans`]: false,
        [`tasks[${idx}]._swipeX`]: -35,
        [`tasks[${idx}]._swipePct`]: 0.22,
      });
    }, 200);

    // 保持 500ms 后弹回
    setTimeout(() => {
      this.setData({
        [`tasks[${idx}]._swipeX`]: 0,
        [`tasks[${idx}]._swipePct`]: 0,
        [`tasks[${idx}]._hintDone`]: true,
      });
    }, 700);
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
