const { callAPI } = require('./request');

const userAPI = {
  login(nickName, avatarUrl) {
    return callAPI('user/login', { nickName, avatarUrl });
  },
  getInfo() {
    return callAPI('user/info');
  },
  getSettings() {
    return callAPI('user/settings/get');
  },
  updateSettings(settings) {
    return callAPI('user/settings/update', { settings });
  },
};

module.exports = userAPI;
