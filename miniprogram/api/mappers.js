/**
 * 后端 task 字段转换为页面 task 字段
 * @param {object} task
 * @returns {{ id: string, text: string, done: boolean, pomodoros: number, completed: number, priority: string }}
 */
function mapTaskToView(task = {}) {
  return {
    id: task._id,
    text: task.title,
    done: !!task.isDone,
    pomodoros: task.estimatedPomodoros || 1,
    completed: task.completedPomodoros || 0,
    priority: task.priority || 'medium',
  };
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

module.exports = {
  mapTaskToView,
  mapDiaryToView,
  mapStatsToView,
  formatDuration,
};
