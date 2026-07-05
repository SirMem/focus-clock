/**
 * diary.service.js — 日记业务逻辑层
 *
 * 封装日记 CRUD 的业务规则，不直接操作数据库。
 * 依赖 DiaryRepo 进行数据访问，通过构造函数注入（DI）方便测试。
 *
 * 契约: docs/api-contracts.md §5
 */

const { EMOTION_TAGS, PAGING } = require('../config');

class DiaryService {
  constructor(diaryRepo) {
    this.diaryRepo = diaryRepo;
  }

  /**
   * 工厂方法 —— 内部自动初始化 DiaryRepo
   */
  static create() {
    const DiaryRepo = require('../repositories/diary.repo');
    return new DiaryService(DiaryRepo.create());
  }

  /**
   * 创建日记
   * @param {string} openId - 用户 OPENID
   * @param {object} params - { content, emotionTags?, tasks? }
   * @returns {Promise<object>} 完整 diary 文档
   */
  async createDiary(openId, { content, emotionTags, tasks }) {
    // 校验情绪标签：只保存合法值
    const safeTags = Array.isArray(emotionTags)
      ? emotionTags.filter(tag => EMOTION_TAGS.includes(tag))
      : [];

    const diary = {
      _openid: openId,
      content: content.trim(),
      emotionTags: safeTags,
      tasks: Array.isArray(tasks) ? tasks : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return this.diaryRepo.insert(diary);
  }

  /**
   * 查询日记列表
   * @param {string} openId - 用户 OPENID
   * @param {object} options - { page, pageSize, date, emotionTag }
   * @returns {Promise<{ diaries: object[], total: number, hasMore: boolean }>}
   */
  async getDiaries(openId, { page = 1, pageSize = 20, date, emotionTag } = {}) {
    const where = { _openid: openId };

    // date 筛选：计算当天 0 点和次日 0 点的时间戳范围
    if (date) {
      const dateStart = new Date(`${date}T00:00:00+08:00`).getTime();
      const dateEnd = dateStart + 24 * 60 * 60 * 1000;
      const _ = this.diaryRepo.db.command;
      where.createdAt = _.gte(dateStart).and(_.lt(dateEnd));
    }

    // emotionTag 筛选：使用 arrayContains
    if (emotionTag) {
      where.emotionTags = this.diaryRepo.db.command.arrayContains(emotionTag);
    }

    const safeSize = Math.min(pageSize, PAGING.PAGE_SIZE_MAX);

    const [diaries, total] = await Promise.all([
      this.diaryRepo.findAll(where, { page, pageSize: safeSize }),
      this.diaryRepo.count(where),
    ]);

    return {
      diaries,
      total,
      hasMore: page * safeSize < total,
    };
  }

  /**
   * 更新日记
   * @param {string} openId - 用户 OPENID
   * @param {string} id - 日记 _id
   * @param {object} data - 要更新的字段
   * @returns {Promise<object|null|false>}
   *   - 成功: { updated: number }
   *   - 404: null
   *   - 403: false（_openid 不匹配）
   */
  async updateDiary(openId, id, data) {
    const existing = await this.diaryRepo.findById(id);
    if (!existing) return null;
    if (existing._openid !== openId) return false;

    // 防止篡改敏感字段
    delete data._openid;
    delete data._id;
    delete data.createdAt;

    // 如果传了 emotionTags，再次校验合法性
    if (data.emotionTags) {
      data.emotionTags = Array.isArray(data.emotionTags)
        ? data.emotionTags.filter(tag => EMOTION_TAGS.includes(tag))
        : [];
    }

    return this.diaryRepo.updateById(id, data);
  }

  /**
   * 删除日记
   * @param {string} openId - 用户 OPENID
   * @param {string} id - 日记 _id
   * @returns {Promise<object|null|false>}
   *   - 成功: { deleted: number }
   *   - 404: null
   *   - 403: false（_openid 不匹配）
   */
  async deleteDiary(openId, id) {
    const existing = await this.diaryRepo.findById(id);
    if (!existing) return null;
    if (existing._openid !== openId) return false;

    return this.diaryRepo.deleteById(id);
  }
}

module.exports = DiaryService;
