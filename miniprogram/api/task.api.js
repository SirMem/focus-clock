const { callAPI } = require('./request');

const taskAPI = {
  create(title, priority = 'medium', estimatedPomodoros = 1) {
    return callAPI('task/create', { title, priority, estimatedPomodoros });
  },
  list(filter = {}, page = 1, pageSize = 20) {
    return callAPI('task/list', { filter, page, pageSize });
  },
  update(id, data) {
    return callAPI('task/update', { id, data });
  },
  delete(id) {
    return callAPI('task/delete', { id });
  },
};

module.exports = taskAPI;
