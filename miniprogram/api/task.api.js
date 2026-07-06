const { callAPI } = require('./request');

function ensureSuccess(res) {
  if (!res || res.code !== 0) {
    const err = new Error(res && res.message || '任务接口调用失败');
    err.response = res;
    throw err;
  }
  return res;
}

const taskAPI = {
  create(taskOrTitle, priority = 'medium', estimatedPomodoros = 1) {
    const payload = typeof taskOrTitle === 'object'
      ? taskOrTitle
      : { title: taskOrTitle, priority, estimatedPomodoros };
    return callAPI('task/create', payload).then(ensureSuccess);
  },
  list(filter = {}, page = 1, pageSize = 20) {
    return callAPI('task/list', { filter, page, pageSize }).then(ensureSuccess);
  },
  update(id, data) {
    return callAPI('task/update', { id, data }).then(ensureSuccess);
  },
  delete(id) {
    return callAPI('task/delete', { id }).then(ensureSuccess);
  },
};

module.exports = taskAPI;
