const { callAPI } = require('./request');

const statsAPI = {
  today() {
    return callAPI('stats/today');
  },
  weekly() {
    return callAPI('stats/weekly');
  },
  monthly() {
    return callAPI('stats/monthly');
  },
  heatmap(year, month) {
    return callAPI('stats/heatmap', { year, month });
  },
};

module.exports = statsAPI;
