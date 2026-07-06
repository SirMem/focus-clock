const { callAPI } = require('./request');
const { mapEmotionToCanonical } = require('./mappers');

const diaryAPI = {
  /**
   * 创建日记（canonical）
   * @param {{ content: string, emotionTags?: string[], tasks?: string[] }|string} params
   * @param {string} [legacyContent] Deprecated: old signature create(title, content, mood, tags)
   * @param {string} [legacyMood]
   * @param {string[]} [legacyTags]
   */
  create(params, legacyContent, legacyMood, legacyTags = []) {
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      const { content, emotionTags = [], tasks = [] } = params;
      const safeEmotionTags = Array.isArray(emotionTags)
        ? emotionTags.map(mapEmotionToCanonical)
        : [];
      return callAPI('diary/create', { content, emotionTags: safeEmotionTags, tasks });
    }

    const legacyEmotionTags = legacyMood
      ? [mapEmotionToCanonical(legacyMood)]
      : (Array.isArray(legacyTags) ? legacyTags.map(mapEmotionToCanonical) : []);

    // Deprecated compatibility path for existing page code until WP2 updates diary.js.
    return callAPI('diary/create', {
      content: legacyContent || '',
      emotionTags: legacyEmotionTags,
      tasks: [],
    });
  },

  /**
   * 获取日记列表
   *
   * Canonical 后端仅支持 date 单日筛选和 emotionTag 筛选。
   * startDate 是旧调用兼容别名，会被当作 date 使用；endDate 当前不支持。
   *
   * @param {{ page?: number, pageSize?: number, date?: string, emotionTag?: string, startDate?: string }} [params]
   */
  list({ page, pageSize, date, emotionTag, startDate } = {}) {
    return callAPI('diary/list', {
      page,
      pageSize,
      date: date || startDate,
      emotionTag,
    }).then(res => {
      // Deprecated compatibility alias until WP2 updates diary.js to read data.diaries.
      if (res && res.code === 0 && res.data && Array.isArray(res.data.diaries) && !res.data.entries) {
        return { ...res, data: { ...res.data, entries: res.data.diaries } };
      }
      return res;
    });
  },

  /**
   * @deprecated 当前后端未注册 diary/get，P0 页面不得依赖该方法。
   */
  get(id) {
    return callAPI('diary/get', { id });
  },

  update(id, data) {
    return callAPI('diary/update', { id, data });
  },

  delete(id) {
    return callAPI('diary/delete', { id });
  },
};

module.exports = diaryAPI;
