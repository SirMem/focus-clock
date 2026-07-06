const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  throwOnNotFound: false,
});

function getDb() {
  return cloud.database();
}

function getOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID || '';
}

function getWxContext() {
  return cloud.getWXContext();
}

module.exports = {
  cloud,
  getDb,
  getOpenId,
  getWxContext,
};
