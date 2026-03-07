#!/usr/bin/env node
/**
 * 控制台查看某角色的队伍妖灵（6 格）
 * 用法: node scripts/console-party.js <characterId>
 * 需要 MONGODB_URI（或默认 mongodb://localhost:27017/game）
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Character = require('../models/Character');
const PlayerSpirit = require('../models/PlayerSpirit');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';
const characterId = process.argv[2];

function padNum(n, len = 3) {
  return String(n).padStart(len, '0');
}

async function main() {
  if (!characterId) {
    console.log('用法: node scripts/console-party.js <characterId>');
    console.log('示例: node scripts/console-party.js 507f1f77bcf86cd799439011');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const character = await Character.findById(characterId).select('name slot').lean();
  if (!character) {
    console.error('未找到角色:', characterId);
    process.exit(1);
  }

  const docs = await PlayerSpirit.find({
    character: characterId,
    partySlot: { $gte: 0, $lte: 5 },
  })
    .populate('spirit', 'number name')
    .sort({ partySlot: 1 })
    .lean();

  const slotMap = {};
  for (const p of docs) {
    const slot = p.partySlot ?? 0;
    if (slot >= 0 && slot <= 5) slotMap[slot] = p;
  }

  console.log('');
  console.log('=== 队伍妖灵 ===');
  console.log('角色:', character.name, `(位${character.slot})`, `[${characterId}]`);
  console.log('');

  for (let i = 0; i < 6; i++) {
    const p = slotMap[i];
    const slotLabel = `格 ${i + 1}`;
    if (!p) {
      console.log(`  ${slotLabel}: (空)`);
      continue;
    }
    const num = p.spirit?.number ?? 0;
    const name = p.spirit?.name ?? '?';
    const lv = p.level ?? 1;
    const nick = p.nickname ? ` "${p.nickname}"` : '';
    console.log(`  ${slotLabel}: #${padNum(num)} ${name} Lv.${lv}${nick}`);
  }

  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
