#!/usr/bin/env node
/**
 * 迁移：单格堆叠上限 99
 * 1. 删除 character+item 唯一索引（允许多格同物品）
 * 2. 将 quantity > 99 的记录拆分为多格
 * 用法：node scripts/migrate-stack-limit.js
 */
require('dotenv').config();
require('../config/db');
const mongoose = require('mongoose');
const PlayerItem = require('../models/PlayerItem');
const STACK_LIMIT = PlayerItem.STACK_LIMIT;

async function run() {
  const coll = mongoose.connection.collection('playeritems');
  try {
    const indexes = await coll.indexes();
    const uniqueIdx = indexes.find((i) => i.name === 'character_1_item_1' && i.unique);
    if (uniqueIdx) {
      await coll.dropIndex('character_1_item_1');
      console.log('已删除 character+item 唯一索引');
    }
  } catch (e) {
    if (e.code === 27 || e.codeName === 'IndexNotFound') console.log('索引已不存在，跳过');
    else throw e;
  }

  const over = await PlayerItem.find({ quantity: { $gt: STACK_LIMIT } }).sort({ character: 1, slot: 1 });
  for (const pi of over) {
    const total = pi.quantity;
    const first = Math.min(STACK_LIMIT, total);
    const remainder = total - first;
    pi.quantity = first;
    await pi.save();
    if (remainder > 0) {
      const maxSlot = await PlayerItem.findOne({ character: pi.character }).sort({ slot: -1 }).select('slot').lean();
      let slot = (maxSlot?.slot ?? -1) + 1;
      let left = remainder;
      while (left > 0) {
        const q = Math.min(left, STACK_LIMIT);
        await PlayerItem.create({ character: pi.character, item: pi.item, quantity: q, slot });
        left -= q;
        slot++;
      }
    }
    console.log(`已拆分 ${pi._id} (原 ${total} → 多格)`);
  }
  if (over.length === 0) console.log('无 quantity > 99 的记录');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
