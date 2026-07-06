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
 * 后端 diary 字段转换为页面 diary 字段
 * @param {object} entry
 * @returns {{ id: string, date: string, emotion: string, preview: string, content: string, title: string }}
 */
function mapDiaryToView(entry = {}) {
  const content = entry.content || '';

  return {
    id: entry._id,
    date: entry.date,
    emotion: entry.mood || 'calm',
    preview: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
    content,
    title: entry.title || '',
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
};
