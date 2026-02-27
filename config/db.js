const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).catch((err) => {
  console.error('MongoDB 连接失败:', err.message);
  console.error('请启动 MongoDB: systemctl start mongod 或 docker start mongo');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB 已连接');
});

module.exports = mongoose;
