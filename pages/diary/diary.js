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
const { mapDiaryToView } = require('../../miniprogram/api/mappers');

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    todayDate: '',
    emotions: EMOTIONS,
    selectedEmotion: 'calm',
    currentPrompt: AI_PROMPTS[0],
    content: '',
    maxChars: 500,
    charCount: 0,
    todayTasks: [],
    historyEntries: [],
    loading: false,
    todayStats: null,
  },

  async onLoad() {
    const sys = wx.getWindowInfo();
    const statusBarHeight = sys.statusBarHeight || 44;
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${days[now.getDay()]}`;
    const promptIdx = Math.floor(Math.random() * AI_PROMPTS.length);
    this.setData({
      statusBarHeight,
      capsuleHeight: 44,
      todayDate: dateStr,
      currentPrompt: AI_PROMPTS[promptIdx],
    });

    await Promise.all([
      this._loadEntries(),
      this._loadTodaySummary(),
    ]);
  },

  async _loadEntries() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await diaryAPI.list({ pageSize: 50 });
      wx.hideLoading();
      if (res.code === 0) {
        const historyEntries = (res.data.entries || []).map(mapDiaryToView);
        this.setData({ historyEntries });
      } else {
        wx.showToast({ title: '日记加载失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '日记加载失败', icon: 'none' });
    }
  },

  async _loadTodaySummary() {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        taskAPI.list({ isDone: true }, 1, 20),
        statsAPI.today(),
      ]);
      const todayTasks = (tasksRes.data.tasks || []).slice(0, 3).map(t => ({
        id: t._id,
        text: t.title,
        duration: Math.round((t.completedPomodoros || 0) * 25),
        completed: true,
      }));
      this.setData({
        todayTasks,
        todayStats: statsRes.data,
      });
    } catch (err) {
      console.error('加载今日摘要失败', err);
    }
  },

  onEmotionSelect(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedEmotion: id });
  },

  onContentInput(e) {
    const val = e.detail.value;
    this.setData({
      content: val,
      charCount: val.length,
    });
  },

  async onSave() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请先写点内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await diaryAPI.create(
        this.data.currentPrompt,
        this.data.content,
        this.data.selectedEmotion,
        []
      );
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ content: '', charCount: 0 });
        await this._loadEntries();
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onPhotoTap() {
    wx.showToast({ title: '拍照功能', icon: 'none' });
  },

  onVoiceTap() {
    wx.showToast({ title: '语音输入', icon: 'none' });
  },

  onViewAll() {
    wx.showToast({ title: '查看全部历史', icon: 'none' });
  },

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.id;
    const entry = this.data.historyEntries.find(item => item.id === id);
    if (entry) {
      wx.showToast({ title: entry.title || entry.preview, icon: 'none' });
    } else {
      wx.showToast({ title: '日记详情', icon: 'none' });
    }
  },

  onMenuTap() {
    wx.showToast({ title: '更多功能', icon: 'none' });
  },
});
