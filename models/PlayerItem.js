const mongoose = require('mongoose');

/** 单格堆叠上限，超出部分占用新格子 */
const STACK_LIMIT = 99;

// 玩家物品（背包）- 关联角色与物品，记录数量与格子位置（每个账号 3 个角色）
const playerItemSchema = new mongoose.Schema({
  character: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1,
    max: STACK_LIMIT,
  },
  slot: {
    type: Number,
    default: 0,
    min: 0,
    max: 999,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// 单格堆叠上限 99，同物品可占多格，故不设 character+item 唯一索引
playerItemSchema.index({ character: 1, item: 1 });
playerItemSchema.index({ character: 1, slot: 1 });

playerItemSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const PlayerItem = mongoose.model('PlayerItem', playerItemSchema);

module.exports = PlayerItem;
module.exports.STACK_LIMIT = STACK_LIMIT;
