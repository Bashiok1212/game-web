#!/usr/bin/env node
/**
 * 创建管理员账号
 * 用法: node scripts/create-admin.js [用户名] [密码]
 * 或设置环境变量: ADMIN_USER=admin ADMIN_PASS=yourpassword
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';
const username = process.argv[2] || process.env.ADMIN_USER || 'admin';
const password = process.argv[3] || process.env.ADMIN_PASS || 'admin123456';

async function main() {
  await mongoose.connect(MONGODB_URI);
  let user = await User.findOne({ username });
  if (user) {
    user.role = 'ow';
    user.password_hash = bcrypt.hashSync(password, 12);
    await user.save({ validateBeforeSave: false });
    console.log('已更新管理员:', username);
  } else {
    user = new User({
      username,
      email: `admin_${username}@system.local`,
      password_hash: bcrypt.hashSync(password, 12),
      role: 'ow',
    });
    await user.save();
    console.log('已创建管理员:', username);
  }
  console.log('请使用该账号登录 /admin 管理后台');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
