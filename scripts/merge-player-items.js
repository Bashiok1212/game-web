#!/usr/bin/env node
/**
 * 合并同角色同物品的多条记录为一条（还原堆叠逻辑前，若有拆分数据需先合并）
 * 用法：node scripts/merge-player-items.js
 */
require('dotenv').config();
require('../config/db');
const mongoose = require('mongoose');
const PlayerItem = require('../models/PlayerItem');

async function run() {
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
  }
  const items = await PlayerItem.find({}).sort({ character: 1, item: 1, slot: 1 }).lean();
  const byKey = {};
  for (const pi of items) {
    const key = `${pi.character}_${pi.item}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(pi);
  }
  let merged = 0;
  for (const key of Object.keys(byKey)) {
    const list = byKey[key];
    if (list.length <= 1) continue;
    const [first, ...rest] = list;
    const totalQty = list.reduce((s, p) => s + (p.quantity || 0), 0);
    await PlayerItem.findByIdAndUpdate(first._id, { quantity: totalQty });
    for (const p of rest) {
      await PlayerItem.findByIdAndDelete(p._id);
      merged++;
    }
  }
  console.log(merged > 0 ? `已合并 ${merged} 条重复记录` : '无重复记录');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
