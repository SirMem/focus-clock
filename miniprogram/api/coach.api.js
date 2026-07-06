const { callAPI } = require('./request');

const coachAPI = {
  score() {
    return callAPI('coach/score');
  },
  tip() {
    return callAPI('coach/tip');
  },
};

module.exports = coachAPI;
