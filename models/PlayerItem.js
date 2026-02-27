const mongoose = require('mongoose');

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

playerItemSchema.index({ character: 1, item: 1 }, { unique: true });
playerItemSchema.index({ character: 1, slot: 1 });

playerItemSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const PlayerItem = mongoose.model('PlayerItem', playerItemSchema);

module.exports = PlayerItem;
