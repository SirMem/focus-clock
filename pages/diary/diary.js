const EMOTIONS = [
  { emoji: '😊', label: '开心', id: 'happy' },
  { emoji: '😐', label: '平静', id: 'calm' },
  { emoji: '😢', label: '沮丧', id: 'sad' },
  { emoji: '😤', label: '焦虑', id: 'anxious' },
  { emoji: '🤩', label: '兴奋', id: 'excited' },
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
} = require('../../miniprogram/api/mappers');

Page({
  data: {
    statusBarHeight: 44,
    capsuleHeight: 44,

    todayDate: '',
    emotions: EMOTIONS,
    selectedEmotion: 'calm',
    currentPrompt: AI_PROMPTS[0],
    content: '',
    canSave: false,
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
    try {
      const res = await diaryAPI.list({ pageSize: 50 });
      if (res.code === 0) {
        // 后端返回 res.data.diaries，diary.api.list 做兼容映射同时提供 entries
        const diaries = (res.data && (res.data.diaries || res.data.entries)) || [];
        const historyEntries = diaries.map(mapDiaryToView);
        this.setData({ historyEntries });
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

      const todayTasks = ((tasksRes.data && tasksRes.data.tasks) || []).slice(0, 3).map(t => ({
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
      console.error('加载已完成任务摘要失败', err);
      wx.showToast({ title: '摘要加载失败', icon: 'none' });
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

  onViewAll() {
    wx.showToast({ title: '历史记录页面开发中', icon: 'none' });
  },

  onHistoryTap(e) {
    const id = e.currentTarget.dataset.id;
    const entry = this.data.historyEntries.find(item => item.id === id);
    if (entry) {
      // 弹窗预览日记全文
      wx.showModal({
        title: entry.date || '日记详情',
        content: entry.content || entry.preview || '暂无内容',
        showCancel: false,
        confirmText: '关闭',
      });
    }
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
