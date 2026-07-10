const EMOTIONS = [
  { emoji: '😊', label: '开心', id: 'happy' },
  { emoji: '😐', label: '平静', id: 'calm' },
  { emoji: '😢', label: '沮丧', id: 'sad' },
  { emoji: '😤', label: '焦虑', id: 'anxious' },
  { emoji: '🧘', label: '专注', id: 'focused' },
];

const AI_PROMPTS = [
  '今天哪个番茄最难坚持？为什么？',
  '哪个时段专注度最高？做了什么让你保持专注？',
  '今天有哪些进步值得表扬自己？',
  '遇到的最大挑战是什么？如何克服的？',
  '明天想在哪方面做得更好？',
];

const diaryAPI = require('../../miniprogram/api/diary.api');
const taskAPI = require('../../miniprogram/api/task.api');
const statsAPI = require('../../miniprogram/api/stats.api');
const {
  mapDiaryToView,
  mapEmotionToCanonical,
  formatDiaryDate,
  mapCanonicalToEmotion,
} = require('../../miniprogram/api/mappers');

const DATE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'last', label: '上月' },
  { key: 'custom', label: '自定义' },
];

/** 前端纯函数：按日期 + 情绪筛选日记 */
function _filterEntries(entries, dateFilter, emotionFilter) {
  let list = entries ? [...entries] : [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateFilter === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    list = list.filter(e => e.createdAt >= weekStart.getTime());
  } else if (dateFilter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    list = list.filter(e => e.createdAt >= monthStart.getTime());
  } else if (dateFilter === 'last') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    list = list.filter(e => e.createdAt >= lastMonthStart.getTime() && e.createdAt < thisMonthStart.getTime());
  }

  if (emotionFilter) {
    list = list.filter(e => e.emotion === emotionFilter);
  }

  return list;
}

/** 按月份分组 */
function _groupByMonth(entries) {
  const groups = [];
  for (const entry of entries) {
    // 从 date 字段解析月份，如 "7月10日 周三" → "7月"
    const m = (entry.date || '').match(/(\d+)月(\d+)日/);
    if (!m) { groups.push({ month: '', entries: [entry] }); continue; }
    const monthKey = m[1];
    const last = groups[groups.length - 1];
    if (last && last.monthKey === monthKey) {
      last.entries.push(entry);
    } else {
      groups.push({ monthKey, label: `${nowGetFullYear()}年${monthKey}月`, entries: [entry] });
    }
  }
  return groups;
}

function nowGetFullYear() { return new Date().getFullYear(); }

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    // 视图路由
    view: 'write',          // 'write' | 'history' | 'detail'
    prevView: 'write',

    // 写日记
    todayDate: '',
    todaySubtitle: '',
    emotions: EMOTIONS,
    selectedEmotion: 'calm',
    currentPrompt: AI_PROMPTS[0],
    content: '',
    canSave: false,
    maxChars: 2000,
    charCount: 0,
    todayTasks: [],
    todayStats: null,

    // 历史列表
    historyEntries: [],
    filteredEntries: [],
    dateFilters: DATE_FILTERS,
    dateFilter: 'all',
    emotionFilter: null,
    showDatePicker: false,
    filterApplied: false,
    filterLabel: '',
    filterEmoji: '',
    filterEmotionLabel: '',
    customDateStart: '',
    customDateEnd: '',

    loading: false,

    // 日记详情
    selectedEntry: null,
    detailPrevEntry: null,
    detailNextEntry: null,
  },

  async onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const dayStr = `周${days[now.getDay()]}`;
    const promptIdx = Math.floor(Math.random() * AI_PROMPTS.length);
    this.setData({
      statusBarHeight,
      capsuleHeight: 44,
      todayDate: dateStr,
      todaySubtitle: dayStr,
      currentPrompt: AI_PROMPTS[promptIdx],
    });

    await Promise.all([
      this._loadEntries(),
      this._loadTodaySummary(),
    ]);
  },

  async _loadEntries() {
    try {
      const res = await diaryAPI.list({ pageSize: 50 });
      if (res.code === 0) {
        const diaries = (res.data && (res.data.diaries || res.data.entries)) || [];
        const historyEntries = diaries.map(mapDiaryToView);
        const filteredEntries = _filterEntries(historyEntries, this.data.dateFilter, this.data.emotionFilter);
        this.setData({ historyEntries, filteredEntries });
      } else {
        wx.showToast({ title: '日记加载失败', icon: 'none' });
      }
    } catch (err) {
      console.error('加载日记列表失败', err);
      wx.showToast({ title: '日记加载失败', icon: 'none' });
    }
  },

  async _loadTodaySummary() {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        taskAPI.list({ isDone: true }, 1, 20),
        statsAPI.today(),
      ]);

      if (tasksRes.code !== 0 || statsRes.code !== 0) {
        console.warn('摘要加载失败', { tasksRes, statsRes });
        wx.showToast({ title: '摘要加载失败', icon: 'none' });
        return;
      }

      const data = statsRes.data;
      const pomodoroCount = data.pomodoroCount || 0;
      const focusMinutes = data.focusMinutes || 0;
      const todayTasks = ((tasksRes.data && tasksRes.data.tasks) || []).slice(0, 3).map(t => ({
        id: t._id,
        text: t.title,
        duration: Math.round((t.completedPomodoros || 0) * 25),
        completed: true,
      }));

      // 更新副标题：周X · 今日已完成 X 个番茄
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      const dayStr = `周${days[new Date().getDay()]}`;
      const subtitle = `${dayStr} · 今日已完成 ${pomodoroCount} 个番茄`;

      this.setData({
        todayTasks,
        todayStats: data,
        todaySubtitle: subtitle,
      });
    } catch (err) {
      console.error('加载已完成任务摘要失败', err);
      wx.showToast({ title: '摘要加载失败', icon: 'none' });
    }
  },

  // ===== 视图路由 =====

  onViewAll() {
    const filteredEntries = _filterEntries(this.data.historyEntries, this.data.dateFilter, null);
    this.setData({ view: 'history', filteredEntries, dateFilter: 'all', emotionFilter: null, filterApplied: false });
  },

  onHistoryBack() {
    this.setData({ view: 'write' });
  },

  // ===== 历史筛选 =====

  onDateFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    const filteredEntries = _filterEntries(this.data.historyEntries, key, this.data.emotionFilter);
    const filterLabel = key !== 'all' ? (DATE_FILTERS.find(f => f.key === key)?.label || '') : '';
    this.setData({
      dateFilter: key,
      filteredEntries,
      filterApplied: key !== 'all' || this.data.emotionFilter !== null,
      showDatePicker: key === 'custom',
      filterLabel,
    });
  },

  onEmotionFilterTap(e) {
    const id = e.currentTarget.dataset.id;
    const newFilter = this.data.emotionFilter === id ? null : id;
    const filteredEntries = _filterEntries(this.data.historyEntries, this.data.dateFilter, newFilter);
    const emotion = newFilter ? this.data.emotions.find(e => e.id === newFilter) : null;
    this.setData({
      emotionFilter: newFilter,
      filteredEntries,
      filterApplied: this.data.dateFilter !== 'all' || newFilter !== null,
      filterEmoji: emotion ? emotion.emoji : '',
      filterEmotionLabel: emotion ? emotion.label : '',
    });
  },

  onClearFilter(e) {
    const type = e.currentTarget.dataset.type;
    const newDateFilter = type === 'date' ? 'all' : this.data.dateFilter;
    const newEmotionFilter = type === 'emotion' ? null : this.data.emotionFilter;
    const filteredEntries = _filterEntries(this.data.historyEntries, newDateFilter, newEmotionFilter);
    const filterLabel = newDateFilter !== 'all' ? (DATE_FILTERS.find(f => f.key === newDateFilter)?.label || '') : '';
    const emotion = newEmotionFilter ? this.data.emotions.find(e => e.id === newEmotionFilter) : null;
    this.setData({
      dateFilter: newDateFilter,
      emotionFilter: newEmotionFilter,
      filteredEntries,
      filterApplied: newDateFilter !== 'all' || newEmotionFilter !== null,
      showDatePicker: type === 'date' ? false : this.data.showDatePicker,
      filterLabel,
      filterEmoji: emotion ? emotion.emoji : '',
      filterEmotionLabel: emotion ? emotion.label : '',
    });
  },

  onClearAllFilters() {
    this.setData({
      dateFilter: 'all',
      emotionFilter: null,
      filteredEntries: _filterEntries(this.data.historyEntries, 'all', null),
      filterApplied: false,
      showDatePicker: false,
      filterLabel: '',
      filterEmoji: '',
      filterEmotionLabel: '',
    });
  },

  onCustomDateStart(e) {
    const val = e.detail.value;
    this.setData({ customDateStart: val });
    // 自动触发筛选（当两个日期都选好时）
    if (val && this.data.customDateEnd) this._applyCustomDateFilter();
  },

  onCustomDateEnd(e) {
    const val = e.detail.value;
    this.setData({ customDateEnd: val });
    if (this.data.customDateStart && val) this._applyCustomDateFilter();
  },

  _applyCustomDateFilter() {
    const start = new Date(this.data.customDateStart).getTime();
    const end = new Date(this.data.customDateEnd + 'T23:59:59').getTime();
    const filtered = this.data.historyEntries.filter(e => e.createdAt >= start && e.createdAt <= end);
    this.setData({ filteredEntries: filtered, filterApplied: true });
  },

  // ===== 写日记 =====

  onEmotionSelect(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedEmotion: id });
  },

  onContentInput(e) {
    const val = e.detail.value;
    this.setData({
      content: val,
      canSave: val.trim().length > 0,
      charCount: val.length,
    });
  },

  async onSave() {
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '请先写点内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await diaryAPI.create({
        content,
        emotionTags: [mapEmotionToCanonical(this.data.selectedEmotion)],
        tasks: this.data.todayTasks.map(t => t.id),
      });
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ content: '', canSave: false, charCount: 0 });
        await this._loadEntries();
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存日记失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onPhotoTap() {
    wx.showToast({ title: '拍照功能开发中，敬请期待', icon: 'none' });
  },

  onVoiceTap() {
    wx.showToast({ title: '语音输入开发中，敬请期待', icon: 'none' });
  },

  // ===== 详情视图 =====

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.id;
    const entry = this.data.historyEntries.find(item => item.id === id);
    if (entry) {
      this._openDetail(entry);
    }
  },

  /** 打开详情视图，记录来自哪个视图 */
  _openDetail(entry) {
    const idx = this.data.historyEntries.findIndex(item => item.id === entry.id);
    const detailPrevEntry = idx < this.data.historyEntries.length - 1 ? this.data.historyEntries[idx + 1] : null;
    const detailNextEntry = idx > 0 ? this.data.historyEntries[idx - 1] : null;
    this.setData({
      view: 'detail',
      prevView: this.data.view,
      selectedEntry: entry,
      detailPrevEntry,
      detailNextEntry,
    });
  },

  onDetailBack() {
    this.setData({ view: this.data.prevView, selectedEntry: null, detailPrevEntry: null, detailNextEntry: null });
  },

  onDetailPrev() {
    const prev = this.data.detailPrevEntry;
    if (!prev) return;
    this._openDetail(prev);
  },

  onDetailNext() {
    const next = this.data.detailNextEntry;
    if (!next) return;
    this._openDetail(next);
  },

  onMenuTap() {
    wx.showActionSheet({
      itemList: ['按日期筛选', '按心情筛选'],
      success(res) {
        const action = res.tapIndex === 0 ? '日期筛选' : '心情筛选';
        wx.showToast({ title: `${action}功能开发中`, icon: 'none' });
      },
    });
  },
});
