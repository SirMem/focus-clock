/**
 * task.service.js — 待办任务业务逻辑层
 *
 * 封装任务 CRUD 的业务规则，不直接操作数据库。
 * 依赖 TaskRepo 进行数据访问，通过构造函数注入（DI）方便测试。
 *
 * 契约: docs/api-contracts.md §2
 */

const {
  PRIORITIES,
  PRIORITY_DEFAULT,
  PAGING,
  TASK_REPEAT_TYPES,
  TASK_REPEAT_DEFAULT,
  TASK_LIMITS,
} = require('../config');

const { getDateStr } = require('../utils/helpers');

const UPDATABLE_FIELDS = [
  'title',
  'description',
  'priority',
  'isDone',
  'estimatedPomodoros',
  'completedPomodoros',
  'subtasks',
  'dueAt',
  'repeat',
  'sortOrder',
];

class TaskValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

class TaskService {
  /**
   * @param {import('../repositories/task.repo')} taskRepo
   * @param {import('../repositories/daily-summary.repo')} dailySummaryRepo
   */
  constructor(taskRepo, dailySummaryRepo) {
    this.taskRepo = taskRepo;
    this.dailySummaryRepo = dailySummaryRepo;
  }

  /**
   * 工厂方法 —— 内部自动初始化 TaskRepo + DailySummaryRepo
   */
  static create() {
    const TaskRepo = require('../repositories/task.repo');
    const DailySummaryRepo = require('../repositories/daily-summary.repo');
    return new TaskService(TaskRepo.create(), DailySummaryRepo.create());
  }

  /**
   * 创建任务
   * @param {string} openId - 用户 OPENID
   * @param {object} params - Task v2 创建参数
   * @returns {Promise<object>} 完整 task 文档
   */
  async createTask(openId, params = {}) {
    const now = Date.now();
    const task = {
      _openid: openId,
      ...this._normalizeTaskInput(params, { now, isCreate: true }),
      isDone: false,
      completedPomodoros: 0,
      sortOrder: now,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    return this.taskRepo.insert(task);
  }

  /**
   * 查询任务列表
   * @param {string} openId - 用户 OPENID
   * @param {object} options - { filter, page, pageSize }
   * @returns {Promise<{ tasks: object[], total: number, hasMore: boolean }>}
   */
  async getTasks(openId, { filter = {}, page = 1, pageSize = 20 } = {}) {
    const where = { _openid: openId };

    if (filter.isDone !== undefined) {
      where.isDone = filter.isDone;
    }
    if (filter.priority) {
      where.priority = filter.priority;
    }

    const safePage = Math.max(1, Math.floor(Number(page) || PAGING.PAGE_DEFAULT));
    const safeSize = Math.min(
      PAGING.PAGE_SIZE_MAX,
      Math.max(1, Math.floor(Number(pageSize) || PAGING.PAGE_SIZE_DEFAULT))
    );

    const [tasks, total] = await Promise.all([
      this.taskRepo.findAll(where, { page: safePage, pageSize: safeSize }),
      this.taskRepo.count(where),
    ]);

    return {
      tasks: tasks.map(task => this.normalizeTask(task)),
      total,
      hasMore: safePage * safeSize < total,
    };
  }

  /**
   * 更新任务
   * @param {string} openId - 用户 OPENID
   * @param {string} id - 任务 _id
   * @param {object} data - 要更新的字段
   * @returns {Promise<object|null|false>}
   *   - 成功: { updated: number }
   *   - 404: null
   *   - 403: false（_openid 不匹配）
   */
  async updateTask(openId, id, data) {
    const existing = await this.taskRepo.findById(id);
    if (!existing) return null;
    if (existing._openid !== openId) return false;

    const now = Date.now();
    const updateData = this._normalizeUpdateInput(data, existing, now);

    const result = await this.taskRepo.updateById(id, updateData);

    // [PRD] 任务刚被标记完成 → 同步到 daily_summaries
    // _normalizeUpdateInput 已在 false→true 时设置 completedAt=now，此处复用同一条件
    // [BDD 场景2] 只有 isDone 从 false→true 时才触发，防止重复计数
    const becameDone = data.isDone === true && !existing.isDone;
    if (becameDone) {
      try {
        const today = getDateStr();
        await this.dailySummaryRepo.upsert(openId, today, {
          completedTasks: 1,  // 原子 +1（已有记录走 _.inc()，新记录走初始值）
        });
      } catch (err) {
        // 部分写入容错：task 已更新但 daily_summaries 写入失败
        // 策略：仅记录日志，不 revert task（微信云数据库无事务支持）
        console.error('[TaskService.updateTask] daily_summaries upsert 失败，completedTasks 丢失 +1:', err.message);
      }
    }

    return result;
  }

  /**
   * 删除任务
   * @param {string} openId - 用户 OPENID
   * @param {string} id - 任务 _id
   * @returns {Promise<object|null|false>}
   *   - 成功: { deleted: number }
   *   - 404: null
   *   - 403: false（_openid 不匹配）
   */
  async deleteTask(openId, id) {
    const existing = await this.taskRepo.findById(id);
    if (!existing) return null;
    if (existing._openid !== openId) return false;

    return this.taskRepo.deleteById(id);
  }

  normalizeTask(task = {}) {
    const now = Date.now();
    return {
      ...task,
      title: this._normalizeTitle(task.title),
      description: this._normalizeDescription(task.description),
      priority: this._normalizePriority(task.priority),
      isDone: !!task.isDone,
      completedPomodoros: Math.max(0, Number(task.completedPomodoros) || 0),
      estimatedPomodoros: this._normalizeEstimatedPomodoros(task.estimatedPomodoros),
      subtasks: this._normalizeSubtasks(task.subtasks, now),
      dueAt: this._normalizeDueAt(task.dueAt),
      repeat: this._normalizeRepeat(task.repeat),
      sortOrder: Number(task.sortOrder) || task.createdAt || now,
      createdAt: Number(task.createdAt) || now,
      updatedAt: Number(task.updatedAt) || Number(task.createdAt) || now,
      completedAt: task.completedAt || null,
    };
  }

  _normalizeTaskInput(params, { now }) {
    return {
      title: this._normalizeTitle(params.title),
      description: this._normalizeDescription(params.description),
      priority: this._normalizePriority(params.priority),
      estimatedPomodoros: this._normalizeEstimatedPomodoros(params.estimatedPomodoros),
      subtasks: this._normalizeSubtasks(params.subtasks, now),
      dueAt: this._normalizeDueAt(params.dueAt),
      repeat: this._normalizeRepeat(params.repeat),
    };
  }

  _normalizeUpdateInput(data, existing, now) {
    const updateData = {};

    for (const field of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(data).some(field => !UPDATABLE_FIELDS.includes(field))) {
      throw new TaskValidationError('data 包含不支持更新的字段');
    }
    if (Object.keys(updateData).length === 0) {
      throw new TaskValidationError('data 至少需要包含一个可更新字段');
    }

    if (updateData.title !== undefined) {
      updateData.title = this._normalizeTitle(updateData.title);
    }
    if (updateData.description !== undefined) {
      updateData.description = this._normalizeDescription(updateData.description);
    }
    if (updateData.priority !== undefined) {
      updateData.priority = this._normalizePriority(updateData.priority);
    }
    if (updateData.estimatedPomodoros !== undefined) {
      updateData.estimatedPomodoros = this._normalizeEstimatedPomodoros(updateData.estimatedPomodoros);
    }
    if (updateData.completedPomodoros !== undefined) {
      updateData.completedPomodoros = Math.max(0, Number(updateData.completedPomodoros) || 0);
    }
    if (updateData.subtasks !== undefined) {
      updateData.subtasks = this._normalizeSubtasks(updateData.subtasks, now);
    }
    if (updateData.dueAt !== undefined) {
      updateData.dueAt = this._normalizeDueAt(updateData.dueAt);
    }
    if (updateData.repeat !== undefined) {
      updateData.repeat = this._normalizeRepeat(updateData.repeat);
    }
    if (updateData.sortOrder !== undefined) {
      updateData.sortOrder = Number(updateData.sortOrder) || now;
    }
    if (updateData.isDone !== undefined) {
      if (typeof updateData.isDone !== 'boolean') {
        throw new TaskValidationError('isDone 必须是布尔值');
      }
      if (!existing.isDone && updateData.isDone) updateData.completedAt = now;
      if (existing.isDone && !updateData.isDone) updateData.completedAt = null;
    }

    return updateData;
  }

  _normalizeTitle(title) {
    const value = typeof title === 'string' ? title.trim() : '';
    if (!value) throw new TaskValidationError('title 不能为空');
    if (value.length > TASK_LIMITS.TITLE_MAX) {
      throw new TaskValidationError(`title 不能超过 ${TASK_LIMITS.TITLE_MAX} 字`);
    }
    return value;
  }

  _normalizeDescription(description) {
    const value = typeof description === 'string' ? description.trim() : '';
    if (value.length > TASK_LIMITS.DESCRIPTION_MAX) {
      throw new TaskValidationError(`description 不能超过 ${TASK_LIMITS.DESCRIPTION_MAX} 字`);
    }
    return value;
  }

  _normalizePriority(priority) {
    if (priority === undefined || priority === null || priority === '') return PRIORITY_DEFAULT;
    if (!PRIORITIES.includes(priority)) {
      throw new TaskValidationError(`priority 必须在 [${PRIORITIES.join(', ')}] 中`);
    }
    return priority;
  }

  _normalizeEstimatedPomodoros(value) {
    const num = value === undefined || value === null || value === '' ? 1 : Number(value);
    if (!Number.isFinite(num)) throw new TaskValidationError('estimatedPomodoros 必须是数字');
    if (num < TASK_LIMITS.ESTIMATED_POMODOROS_MIN || num > TASK_LIMITS.ESTIMATED_POMODOROS_MAX) {
      throw new TaskValidationError('estimatedPomodoros 必须是 1-12 之间的数字');
    }
    return Math.floor(num);
  }

  _normalizeSubtasks(subtasks, now) {
    if (subtasks === undefined || subtasks === null) return [];
    if (!Array.isArray(subtasks)) throw new TaskValidationError('subtasks 必须是数组');
    if (subtasks.length > TASK_LIMITS.SUBTASKS_MAX) {
      throw new TaskValidationError(`subtasks 不能超过 ${TASK_LIMITS.SUBTASKS_MAX} 个`);
    }

    return subtasks
      .map((subtask, index) => {
        const title = this._normalizeTitle(subtask && subtask.title);
        return {
          id: subtask.id || `subtask_${now}_${index}`,
          title,
          completed: !!subtask.completed,
          createdAt: Number(subtask.createdAt) || now,
          updatedAt: Number(subtask.updatedAt) || now,
        };
      });
  }

  _normalizeDueAt(dueAt) {
    if (dueAt === undefined || dueAt === null || dueAt === '') return null;
    const timestamp = Number(dueAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      throw new TaskValidationError('dueAt 必须是有效时间戳或 null');
    }
    return timestamp;
  }

  _normalizeRepeat(repeat) {
    if (!repeat || typeof repeat !== 'object' || Array.isArray(repeat)) {
      return { ...TASK_REPEAT_DEFAULT };
    }

    const enabled = !!repeat.enabled;
    const type = repeat.type || (enabled ? 'daily' : 'none');
    if (!TASK_REPEAT_TYPES.includes(type)) {
      throw new TaskValidationError(`repeat.type 必须在 [${TASK_REPEAT_TYPES.join(', ')}] 中`);
    }

    const interval = repeat.interval === undefined || repeat.interval === null || repeat.interval === ''
      ? 1
      : Number(repeat.interval);
    if (!Number.isFinite(interval) || interval < TASK_LIMITS.REPEAT_INTERVAL_MIN || interval > TASK_LIMITS.REPEAT_INTERVAL_MAX) {
      throw new TaskValidationError('repeat.interval 必须是 1-365 之间的数字');
    }

    return {
      enabled: enabled && type !== 'none',
      type: enabled ? type : 'none',
      interval: Math.floor(interval),
    };
  }
}

TaskService.TaskValidationError = TaskValidationError;

module.exports = TaskService;
