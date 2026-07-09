const PRIORITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低',
};

const REPEAT_LABELS = {
  none: '',
  daily: '每天重复',
  weekly: '每周重复',
  weekdays: '工作日重复',
};

/**
 * 后端 task 字段转换为页面 task 字段
 * @param {object} task
 * @returns {object}
 */
function mapTaskToView(task = {}) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedSubtasks = subtasks.filter(item => item && item.completed).length;
  const repeat = normalizeRepeat(task.repeat);
  const dueAt = normalizeDueAt(task.dueAt);
  const estimatedPomodoros = task.estimatedPomodoros || 1;
  const completedPomodoros = task.completedPomodoros || 0;

  return {
    id: task._id,
    text: task.title || '',
    description: task.description || '',
    done: !!task.isDone,
    pomodoros: estimatedPomodoros,
    completed: completedPomodoros,
    priority: task.priority || 'medium',
    priorityLabel: PRIORITY_LABELS[task.priority] || PRIORITY_LABELS.medium,
    subtasks,
    subtaskTotal: subtasks.length,
    subtaskDone: completedSubtasks,
    hasSubtasks: subtasks.length > 0,
    subtaskProgressText: subtasks.length > 0 ? `子任务 ${completedSubtasks}/${subtasks.length}` : '',
    dueAt,
    hasDue: !!dueAt,
    dueText: dueAt ? `截止：${formatTaskDueAt(dueAt)}` : '',
    repeat,
    hasRepeat: repeat.enabled,
    repeatText: repeat.enabled ? REPEAT_LABELS[repeat.type] : '',
    pomodoroText: `🍅 ${completedPomodoros}/${estimatedPomodoros}`,
    createdAt: task.createdAt || 0,
    updatedAt: task.updatedAt || 0,
    completedAt: task.completedAt || null,
  };
}

function normalizeRepeat(repeat = {}) {
  const type = repeat.type || 'none';
  return {
    enabled: !!repeat.enabled && type !== 'none',
    type,
    interval: repeat.interval || 1,
  };
}

function normalizeDueAt(dueAt) {
  if (dueAt === undefined || dueAt === null || dueAt === '') return null;
  const timestamp = Number(dueAt);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function formatTaskDueAt(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetTime = targetDay.getTime();
  const timeText = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (targetTime === todayTime) return `今天 ${timeText}`;
  if (targetTime === tomorrow.getTime()) return `明天 ${timeText}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${timeText}`;
}

/**
 * 英文 emotion id → 后端中文情绪标签
 * @param {string} id - 页面英文 id: happy/calm/sad/anxious/excited
 * @returns {string} 后端 canonical 中文标签
 */
function mapEmotionToCanonical(id) {
  const MAP = {
    happy: '开心',
    calm: '平静',
    sad: '沮丧',
    anxious: '焦虑',
    excited: '兴奋',
  };
  return MAP[id] || '平静';
}

/**
 * 后端中文情绪标签 → { emoji, label } 视图对象
 * @param {string} tag - 后端 canonical 中文: 开心/平静/沮丧/焦虑/兴奋/疲惫/无聊
 * @returns {{ emoji: string, label: string }}
 */
function mapCanonicalToEmotion(tag) {
  const MAP = {
    '开心': { emoji: '😊', label: '开心' },
    '平静': { emoji: '😐', label: '平静' },
    '沮丧': { emoji: '😢', label: '沮丧' },
    '焦虑': { emoji: '😤', label: '焦虑' },
    '兴奋': { emoji: '🤩', label: '兴奋' },
    '疲惫': { emoji: '😴', label: '疲惫' },
    '无聊': { emoji: '😶', label: '无聊' },
  };
  return MAP[tag] || { emoji: '📝', label: tag || '未知' };
}

/**
 * 将后端返回的 emotionTags 数组转为页面显示用的情绪文本
 * @param {string[]} emotionTags
 * @returns {string} e.g. "😊 开心"
 */
function formatEmotionDisplay(emotionTags) {
  if (!Array.isArray(emotionTags) || emotionTags.length === 0) return '';
  const e = mapCanonicalToEmotion(emotionTags[0]);
  return `${e.emoji} ${e.label}`;
}

/**
 * 格式化日记创建时间为可读日期
 * @param {number} timestamp - createdAt 毫秒时间戳
 * @returns {string} e.g. "7月9日 周三"
 */
function formatDiaryDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const day = days[d.getDay()];
  return `${month}月${date}日 周${day}`;
}

/**
 * 后端 diary 字段转换为页面 diary 字段（canonical 契约对齐）
 * @param {object} entry
 * @returns {{ id: string, date: string, emotion: string, emotionEmoji: string, emotionLabel: string, preview: string, content: string, title: string }}
 */
function mapDiaryToView(entry = {}) {
  const content = entry.content || '';
  const emotionTags = Array.isArray(entry.emotionTags) ? entry.emotionTags : [];
  const primaryEmotion = mapCanonicalToEmotion(emotionTags[0]);
  const createdAt = entry.createdAt;

  // 兼容旧字段（历史数据可能有 date/mood/title）
  let date;
  if (entry.date) {
    date = entry.date;
  } else if (createdAt) {
    date = formatDiaryDate(createdAt);
  } else {
    date = '';
  }

  return {
    id: entry._id,
    date,
    emotion: emotionTags[0] || entry.mood || 'calm',
    emotionEmoji: primaryEmotion.emoji,
    emotionLabel: primaryEmotion.label,
    preview: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
    content,
    title: entry.title || (date ? `${date} 日记` : ''),
  };
}

/**
 * 后端 stats 字段转换为页面 stats 字段
 * @param {object} stats
 * @returns {object}
 */
function mapStatsToView(stats = {}) {
  return {
    ...stats,
    focusDurationText: formatDuration(stats.focusMinutes || stats.totalFocusMinutes || 0),
    avgDailyFocusText: formatDuration(stats.avgDailyFocus || 0),
  };
}

/**
 * 格式化分钟数
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);

  if (safeMinutes < 60) {
    return `${safeMinutes}m`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

module.exports = {
  mapTaskToView,
  mapDiaryToView,
  mapStatsToView,
  formatDuration,
  mapEmotionToCanonical,
  mapCanonicalToEmotion,
  formatEmotionDisplay,
  formatDiaryDate,
};
