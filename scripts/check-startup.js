#!/usr/bin/env node
// 诊断启动问题：cd /root/web && node scripts/check-startup.js
const path = require('path');
process.chdir(path.join(__dirname, '..'));
console.log('1. 检查 .env...');
require('dotenv').config();
const fs = require('fs');
if (!fs.existsSync('.env')) {
  console.log('   .env 不存在，运行 node scripts/ensure-env.js');
  require('./ensure-env.js');
  require('dotenv').config();
}
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
console.log('   NODE_ENV:', process.env.NODE_ENV || '(未设置)');
console.log('   MONGODB_URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/game');

console.log('2. 检查 MongoDB...');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game', { serverSelectionTimeoutMS: 3000 })
  .then(() => { console.log('   MongoDB 连接成功'); process.exit(0); })
  .catch((err) => { console.log('   MongoDB 连接失败:', err.message); process.exit(1); });
