const taskAPI = require('../../miniprogram/api/task.api');
const { mapTaskToView } = require('../../miniprogram/api/mappers');

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


Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,
    filters: FILTERS,
    hasInput: false,
    tasks: [],
    input: '',
    filter: 'all',
    priorityColors: PRIORITY_COLORS,
    emptyText: '暂无任务，添加一个吧 🎯',
    loading: false,
    errorText: '',
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    const capsuleHeight = 44;
    this.setData({
      statusBarHeight,
      capsuleHeight,
      tasks: [],
    }, () => {
      this._loadTasks();
      this._updateComputed();
    });
  },

  // ─── 筛选参数 ───

  _buildFilterParams() {
    const { filter } = this.data;
    if (filter === 'done') return { isDone: true };
    if (filter === 'active') return { isDone: false };
    return {};
  },

  async _loadTasks({ silent = false } = {}) {
    if (!silent) {
      this.setData({ loading: true, errorText: '' });
      wx.showLoading({ title: '加载中...' });
    }
    try {
      const res = await taskAPI.list(this._buildFilterParams(), 1, 100);
      const tasks = (res.data && res.data.tasks || []).map(mapTaskToView);
      this.setData({ tasks, loading: false }, () => this._updateComputed());
    } catch (err) {
      this.setData({ loading: false, errorText: '任务加载失败' });
      wx.showToast({ title: '任务加载失败', icon: 'none' });
    } finally {
      if (!silent) wx.hideLoading();
    }
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

  // ─── 事件处理 ───

  onInputChange(e) {
    const val = e.detail.value;
    this.setData({
      input: val,
      hasInput: val.trim().length > 0,
    });
  },

  async onAddTask() {
    const text = this.data.input.trim();
    if (!text) return;

    try {
      await taskAPI.create(text, 'medium', 1);
      this.setData({ input: '', hasInput: false });
      await this._loadTasks({ silent: true });
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
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

  async _toggleTaskById(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return;

    try {
      await taskAPI.update(id, { isDone: !task.done });
      await this._loadTasks({ silent: true });
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  _deleteTaskById(id, showConfirm) {
    if (showConfirm) {
      const task = this.data.tasks.find(t => t.id === id);
      wx.showModal({
        title: '删除任务',
        content: `确定删除「${task ? task.text : ''}」吗？`,
        success: (res) => {
          if (res.confirm) {
            this._doDelete(id);
          }
        },
      });
    } else {
      this._doDelete(id);
    }
  },

  async _doDelete(id) {
    try {
      await taskAPI.delete(id);
      await this._loadTasks({ silent: true });
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' });
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
      this._loadTasks({ silent: true });
    });
  },

  onFabTap() {
    // 滚动到顶部并聚焦输入框
    this.setData({ input: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  async onMenuTap() {
    wx.showActionSheet({
      itemList: ['清空已完成任务', '注销'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            const doneTasks = this.data.tasks.filter(t => t.done);
            for (const t of doneTasks) {
              await taskAPI.delete(t.id);
            }
            await this._loadTasks({ silent: true });
          } catch (err) {
            wx.showToast({ title: '清理失败', icon: 'none' });
          }
        }
      },
    });
  },
});
