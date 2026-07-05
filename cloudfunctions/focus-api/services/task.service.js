/**
 * task.service.js — 待办任务业务逻辑层
 *
 * 封装任务 CRUD 的业务规则，不直接操作数据库。
 * 依赖 TaskRepo 进行数据访问，通过构造函数注入（DI）方便测试。
 *
 * 契约: docs/api-contracts.md §2
 */

const { PRIORITIES, PRIORITY_DEFAULT, PAGING } = require('../config');

class TaskService {
  constructor(taskRepo) {
    this.taskRepo = taskRepo;
  }

  /**
   * 工厂方法 —— 内部自动初始化 TaskRepo
   */
  static create() {
    const TaskRepo = require('../repositories/task.repo');
    return new TaskService(TaskRepo.create());
  }

  /**
   * 创建任务
   * @param {string} openId - 用户 OPENID
   * @param {object} params - { title, priority?, estimatedPomodoros? }
   * @returns {Promise<object>} 完整 task 文档
   */
  async createTask(openId, { title, priority = PRIORITY_DEFAULT, estimatedPomodoros = 1 }) {
    const safePriority = PRIORITIES.includes(priority) ? priority : PRIORITY_DEFAULT;

    const task = {
      _openid: openId,
      title: title.trim(),
      priority: safePriority,
      isDone: false,
      completedPomodoros: 0,
      estimatedPomodoros: Math.max(1, Math.min(99, estimatedPomodoros || 1)),
      sortOrder: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

    const safeSize = Math.min(pageSize, PAGING.PAGE_SIZE_MAX);

    const [tasks, total] = await Promise.all([
      this.taskRepo.findAll(where, { page, pageSize: safeSize }),
      this.taskRepo.count(where),
    ]);

    return {
      tasks,
      total,
      hasMore: page * safeSize < total,
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

    // 防止篡改敏感字段
    delete data._openid;
    delete data._id;
    delete data.createdAt;

    return this.taskRepo.updateById(id, data);
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
}

module.exports = TaskService;
