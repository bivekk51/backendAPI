const mockingoose = require('mockingoose');

const connectTestDB = async () => {
  mockingoose.resetAll();
  return Promise.resolve();
};

const disconnectTestDB = async () => {
  mockingoose.resetAll();
  return Promise.resolve();
};

const clearTestDB = async () => {
  mockingoose.resetAll();
  return Promise.resolve();
};

module.exports = {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
};
