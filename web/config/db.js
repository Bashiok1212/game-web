const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';

mongoose.connect(MONGODB_URI).catch((err) => {
  console.error('MongoDB 连接失败:', err.message);
  console.error('请运行: bash scripts/start-mongo.sh');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB 已连接');
});

module.exports = mongoose;
