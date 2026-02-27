#!/usr/bin/env node
/**
 * 移除 festivals 集合的遗留 key_1 唯一索引
 * 解决 E11000 duplicate key error collection: game.festivals index: key_1 dup key: { key: null }
 *
 * 用法: node scripts/drop-festival-key-index.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';

async function main() {
  await mongoose.connect(MONGODB_URI);
  try {
    await mongoose.connection.collection('festivals').dropIndex('key_1');
    console.log('已移除 festivals.key_1 索引');
  } catch (err) {
    if (err.code === 27) {
      console.log('key_1 索引不存在，无需处理');
    } else {
      throw err;
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
