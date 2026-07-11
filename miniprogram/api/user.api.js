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
  submitFeedback(content) {
    return callAPI('feedback/submit', { content });
  },
  submitRating(score) {
    return callAPI('rating/submit', { score });
  },
};

module.exports = userAPI;
