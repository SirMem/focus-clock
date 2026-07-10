const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const { mapTaskToView } = require('../../miniprogram/api/mappers');

const PRIORITY_COLORS = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#C0C4CC',
};

const PRIORITY_OPTIONS = [
  { key: 'low', label: '低' },
  { key: 'medium', label: '中' },
  { key: 'high', label: '高' },
];

const POMODORO_OPTIONS = [1, 2, 3, 4];

const REPEAT_OPTIONS = [
  { key: 'daily', label: '每天' },
  { key: 'weekly', label: '每周' },
  { key: 'weekdays', label: '工作日' },
];

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
];

function createEmptyForm() {
  const now = new Date();
  const date = formatDate(now);
  return {
    title: '',
    description: '',
    priority: 'medium',
    estimatedPomodoros: 1,
    isDone: false,
    enableSubtasks: false,
    subtasks: [{ id: `local_${Date.now()}`, title: '', completed: false }],
    enableDue: false,
    dueDate: date,
    dueTime: '18:00',
    enableRepeat: false,
    repeatType: 'daily',
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,
    filters: FILTERS,
    priorityOptions: PRIORITY_OPTIONS,
    pomodoroOptions: POMODORO_OPTIONS,
    repeatOptions: REPEAT_OPTIONS,
    hasInput: false,
    tasks: [],
    filteredTasks: [],
    input: '',
    filter: 'all',
    priorityColors: PRIORITY_COLORS,
    emptyText: '暂无任务，添加一个吧 🎯',
    loading: false,
    savingTask: false,
    errorText: '',
    showTaskModal: false,
    isEditing: false,
    editingTaskId: null,
    taskForm: createEmptyForm(),
    // 🆕 真实今日统计数据（来自 stats/today）
    realTotalHours: 0,
    realTotalMins: 0,
    realPomodoroCount: 0,
    realStatsLoaded: false,
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    const capsuleHeight = 44;
    this.setData({
      statusBarHeight,
      capsuleHeight,
      tasks: [],
    }, async () => {
      await Promise.all([
        this._loadTasks(),
        this._loadDailyStats(),
      ]);
      this._updateComputed();
    });
  },

  onReady() {
    // 页面就绪后，延迟触发首个任务的"轻推"提示动画
    this._hintTimer = setTimeout(() => this._doSwipeHint(), 1200);
  },

  onUnload() {
    if (this._hintTimer) clearTimeout(this._hintTimer);
  },

  onShow() {
    this._loadDailyStats();
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

  // 🆕 从 stats/today 获取真实今日专注数据
  async _loadDailyStats() {
    try {
      const res = await statsAPI.today();
      if (res.code === 0 && res.data) {
        const data = res.data;
        const focusMinutes = data.focusMinutes || 0;
        const pomodoroCount = data.pomodoroCount || 0;

        this.setData({
          realTotalHours: Math.floor(focusMinutes / 60),
          realTotalMins: focusMinutes % 60,
          realPomodoroCount: pomodoroCount,
          realStatsLoaded: true,
        });
      } else {
        console.warn('stats/today 返回异常:', res);
      }
    } catch (err) {
      console.error('加载今日统计数据失败', err);
      // 静默失败，realStatsLoaded 保持 false → WXML 显示 "--"
    }
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

  // ─── 快速添加 ───

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
      await taskAPI.create({ title: text });
      this.setData({ input: '', hasInput: false });
      await this._loadTasks({ silent: true });
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  // ─── 完整任务弹窗 ───

  onFabTap() {
    this.setData({
      showTaskModal: true,
      isEditing: false,
      editingTaskId: null,
      taskForm: createEmptyForm(),
    });
    this._originalForm = null;
  },

  closeTaskModal() {
    if (this.data.isEditing && this._isDirty()) {
      wx.showModal({
        title: '放弃修改？',
        content: '你有未保存的修改，确定要放弃吗？',
        success: (res) => {
          if (res.confirm) this._closeEdit();
        },
      });
    } else {
      this._closeEdit();
    }
  },

  _closeEdit() {
    this.setData({
      showTaskModal: false,
      savingTask: false,
      isEditing: false,
      editingTaskId: null,
      taskForm: createEmptyForm(),
    });
    this._originalForm = null;
  },

  stopModalTap() {},

  // ─── 脏数据检测 ───

  _formSnapshot(form) {
    return {
      title: form.title,
      description: form.description,
      priority: form.priority,
      estimatedPomodoros: form.estimatedPomodoros,
      isDone: form.isDone,
      enableDue: form.enableDue,
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      enableRepeat: form.enableRepeat,
      repeatType: form.repeatType,
    };
  },

  _isDirty() {
    if (!this._originalForm) return false;
    return JSON.stringify(this._formSnapshot(this.data.taskForm)) !== this._originalForm;
  },

  // ─── 编辑入口 ───

  onCheckboxTap(e) {
    const { id } = e.currentTarget.dataset;
    this._toggleTaskById(id);
  },

  onContentTap(e) {
    const { id } = e.currentTarget.dataset;
    this._openEditModal(id);
  },

  _openEditModal(id) {
    const task = this.data.tasks.find(t => t.id === id);
    if (!task) return;

    let dueDate = '', dueTime = '';
    if (task.dueAt) {
      const d = new Date(task.dueAt);
      dueDate = formatDate(d);
      dueTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const hasDue = !!task.dueAt;
    const hasRepeat = task.repeat && task.repeat.enabled;

    const form = {
      title: task.text,
      description: task.description,
      priority: task.priority,
      estimatedPomodoros: task.pomodoros,
      isDone: task.done,
      enableSubtasks: hasSubtasks,
      subtasks: hasSubtasks
        ? task.subtasks.map(s => ({ ...s }))
        : [{ id: `local_${Date.now()}`, title: '', completed: false }],
      enableDue: hasDue,
      dueDate: dueDate || formatDate(new Date()),
      dueTime: dueTime || '18:00',
      enableRepeat: hasRepeat,
      repeatType: hasRepeat ? task.repeat.type : 'daily',
    };

    this._originalForm = JSON.stringify(this._formSnapshot(form));
    this.setData({
      isEditing: true,
      editingTaskId: id,
      taskForm: form,
      showTaskModal: true,
    });
  },

  onEditStatusToggle() {
    this.setData({ 'taskForm.isDone': !this.data.taskForm.isDone });
  },

  onFormTitleInput(e) {
    this.setData({ 'taskForm.title': e.detail.value });
  },

  onFormDescriptionInput(e) {
    this.setData({ 'taskForm.description': e.detail.value });
  },

  onPrioritySelect(e) {
    this.setData({ 'taskForm.priority': e.currentTarget.dataset.key });
  },

  onPomodoroSelect(e) {
    this.setData({ 'taskForm.estimatedPomodoros': Number(e.currentTarget.dataset.value) });
  },

  toggleFormSubtasks() {
    const enableSubtasks = !this.data.taskForm.enableSubtasks;
    this.setData({ 'taskForm.enableSubtasks': enableSubtasks });
  },

  onSubtaskInput(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ [`taskForm.subtasks[${index}].title`]: e.detail.value });
  },

  onSubtaskToggle(e) {
    const index = e.currentTarget.dataset.index;
    const subtasks = this.data.taskForm.subtasks.slice();
    subtasks[index] = { ...subtasks[index], completed: !subtasks[index].completed };
    this.setData({ 'taskForm.subtasks': subtasks });
    if (this.data.isEditing) this._saveSubtasksInline();
  },

  addSubtask() {
    const subtasks = this.data.taskForm.subtasks.slice();
    if (subtasks.length >= 20) {
      wx.showToast({ title: '最多 20 个步骤', icon: 'none' });
      return;
    }
    subtasks.push({ id: `local_${Date.now()}_${subtasks.length}`, title: '', completed: false });
    this.setData({ 'taskForm.subtasks': subtasks });
    if (this.data.isEditing) this._saveSubtasksInline();
  },

  removeSubtask(e) {
    const index = e.currentTarget.dataset.index;
    const subtasks = this.data.taskForm.subtasks.slice();
    subtasks.splice(index, 1);
    const newSubtasks = subtasks.length ? subtasks : [{ id: `local_${Date.now()}`, title: '', completed: false }];
    this.setData({ 'taskForm.subtasks': newSubtasks });
    if (this.data.isEditing) this._saveSubtasksInline();
  },

  async _saveSubtasksInline() {
    const subtasks = this.data.taskForm.subtasks
      .filter(s => s.title.trim())
      .map(s => ({ title: s.title.trim(), completed: s.completed }));
    try {
      await taskAPI.update(this.data.editingTaskId, { subtasks });
    } catch (err) {
      wx.showToast({ title: '子任务保存失败', icon: 'none' });
    }
  },

  toggleFormDue() {
    this.setData({ 'taskForm.enableDue': !this.data.taskForm.enableDue });
  },

  onDueDateChange(e) {
    this.setData({ 'taskForm.dueDate': e.detail.value });
  },

  onDueTimeChange(e) {
    this.setData({ 'taskForm.dueTime': e.detail.value });
  },

  toggleFormRepeat() {
    const enableRepeat = !this.data.taskForm.enableRepeat;
    this.setData({
      'taskForm.enableRepeat': enableRepeat,
      'taskForm.repeatType': enableRepeat ? this.data.taskForm.repeatType : 'daily',
    });
  },

  onRepeatSelect(e) {
    this.setData({ 'taskForm.repeatType': e.currentTarget.dataset.key });
  },

  async saveTaskFromModal() {
    if (this.data.savingTask) return;

    const form = this.data.taskForm;
    const title = form.title.trim();
    if (!title) {
      wx.showToast({ title: '请填写任务标题', icon: 'none' });
      return;
    }

    const isEditing = this.data.isEditing;

    // 编辑模式下始终提交 subtasks（不依赖 enableSubtasks 开关），
    // 新建模式遵守 enableSubtasks 开关
    const subtasksRaw = form.enableSubtasks || isEditing
      ? form.subtasks
        .map(item => ({ title: item.title.trim(), completed: item.completed }))
        .filter(item => item.title)
      : [];

    const payload = {
      title,
      description: form.description.trim(),
      priority: form.priority,
      estimatedPomodoros: form.estimatedPomodoros,
      isDone: form.isDone,
      subtasks: subtasksRaw,
      dueAt: form.enableDue ? this._buildDueAt(form.dueDate, form.dueTime) : null,
      repeat: form.enableRepeat
        ? { enabled: true, type: form.repeatType, interval: 1 }
        : { enabled: false, type: 'none', interval: 1 },
    };

    this.setData({ savingTask: true });
    try {
      if (isEditing) {
        await taskAPI.update(this.data.editingTaskId, payload);
      } else {
        await taskAPI.create(payload);
      }
      this.setData({
        showTaskModal: false,
        savingTask: false,
        isEditing: false,
        editingTaskId: null,
        taskForm: createEmptyForm(),
      });
      this._originalForm = null;
      await this._loadTasks({ silent: true });
      wx.showToast({ title: isEditing ? '已更新' : '已保存', icon: 'success' });
    } catch (err) {
      this.setData({ savingTask: false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  _buildDueAt(date, time) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
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
      // 轻点 → 仅重置状态，不 toggle（catchtap 事件各自处理）
      this._resetSwipeState(id);
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
    // 检查该任务是否正在被专注页使用中
    const activeFocusTaskId = wx.getStorageSync('focus_active_task');
    if (activeFocusTaskId && activeFocusTaskId === id) {
      wx.showToast({ title: '该任务正在进行专注，无法删除', icon: 'none' });
      return;
    }

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

  async onMenuTap() {
    wx.showActionSheet({
      itemList: ['清空已完成任务', '注销'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            const doneTasks = this.data.tasks.filter(t => t.done);
            for (const t of doneTasks) {
              await this._doDelete(t.id);
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
