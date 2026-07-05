const { callAPI } = require('./request');

const diaryAPI = {
  create(title, content, mood, tags = []) {
    return callAPI('diary/create', { title, content, mood, tags });
  },
  list({ page, pageSize, startDate, endDate } = {}) {
    return callAPI('diary/list', { page, pageSize, startDate, endDate });
  },
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
