const mongoose = require('mongoose');

// 玩家妖灵：单只妖灵的完整数值（区分于图鉴 Spirit）
const playerSpiritSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  character: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true,
  },
  spirit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Spirit',
    required: true,
    index: true,
  },

  nickname: {
    type: String,
    trim: true,
    maxlength: 32,
  },

  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
  },
  exp: {
    type: Number,
    default: 0,
    min: 0,
  },

  nature: {
    type: String,
    default: 'Hardy',
    maxlength: 16,
  },

  // 个体值（0~31）
  ivHp: { type: Number, default: 0, min: 0, max: 31 },
  ivAtk: { type: Number, default: 0, min: 0, max: 31 },
  ivDef: { type: Number, default: 0, min: 0, max: 31 },
  ivSpAtk: { type: Number, default: 0, min: 0, max: 31 },
  ivSpDef: { type: Number, default: 0, min: 0, max: 31 },
  ivSpeed: { type: Number, default: 0, min: 0, max: 31 },

  // 努力值（0~252，总和≤510，限制由业务层控制）
  evHp: { type: Number, default: 0, min: 0, max: 252 },
  evAtk: { type: Number, default: 0, min: 0, max: 252 },
  evDef: { type: Number, default: 0, min: 0, max: 252 },
  evSpAtk: { type: Number, default: 0, min: 0, max: 252 },
  evSpDef: { type: Number, default: 0, min: 0, max: 252 },
  evSpeed: { type: Number, default: 0, min: 0, max: 252 },

  currentHp: {
    type: Number,
    default: 1,
    min: 0,
  },
  status: {
    type: String,
    default: 'none',
    maxlength: 16,
  },

  heldItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
  },

  moves: [
    {
      skill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
      pp: { type: Number, default: 0, min: 0 },
      maxPp: { type: Number, default: 0, min: 0 },
    },
  ],

  friendship: {
    type: Number,
    default: 0,
    min: 0,
    max: 255,
  },
  isShiny: {
    type: Boolean,
    default: false,
  },
  origin: {
    type: String,
    default: '',
    maxlength: 64,
  },
  originalTrainer: {
    type: String,
    default: '',
    trim: true,
    maxlength: 32,
  },
  capturedAt: {
    type: Date,
    default: Date.now,
  },
});

playerSpiritSchema.index({ character: 1, level: -1 });

const PlayerSpirit = mongoose.model('PlayerSpirit', playerSpiritSchema);

module.exports = PlayerSpirit;

