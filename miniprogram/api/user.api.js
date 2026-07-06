const { callAPI } = require('./request');

const userAPI = {
  login(code) {
    return callAPI('user/login', { code });
  },
  getInfo() {
    return callAPI('user/info');
  },
  updateProfile({ nickName, avatarUrl }) {
    return callAPI('user/profile/update', { nickName, avatarUrl });
  },
  getSettings() {
    return callAPI('user/settings/get');
  },
  updateSettings(settings) {
    return callAPI('user/settings/update', { settings });
  },
};

module.exports = userAPI;
