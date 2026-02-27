#!/usr/bin/env node
/**
 * 背包数据库初始化脚本
 * - 为已有 PlayerItem 补全 slot 字段（按 created_at 顺序）
 * - 确保 Character 有 backpackCapacity
 *
 * 用法: node scripts/init-backpack.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Character = require('../models/Character');
const PlayerItem = require('../models/PlayerItem');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB 已连接');

  // 1. 为无 slot 或 slot 异常的 PlayerItem 补全 slot（按角色分组，按 created_at 排序）
  const chars = await Character.find({}).select('_id').lean();
  let updated = 0;
  for (const c of chars) {
    const items = await PlayerItem.find({ character: c._id }).sort({ created_at: 1 }).lean();
    for (let i = 0; i < items.length; i++) {
      const pi = items[i];
      const wantSlot = i;
      if ((pi.slot ?? 0) !== wantSlot) {
        await PlayerItem.updateOne({ _id: pi._id }, { $set: { slot: wantSlot } });
        updated++;
      }
    }
  }
  console.log(`PlayerItem slot 补全: ${updated} 条`);

  // 2. 为无 backpackCapacity 的 Character 设置默认值
  const charUpdated = await Character.updateMany(
    { $or: [{ backpackCapacity: { $exists: false } }, { backpackCapacity: null }] },
    { $set: { backpackCapacity: 30 } }
  );
  console.log(`Character backpackCapacity 补全: ${charUpdated.modifiedCount} 条`);

  console.log('背包初始化完成');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
