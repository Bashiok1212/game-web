const mongoose = require('mongoose');

// 妖灵模型 - 结构参考宝可梦（编号、名称、属性、种族值等）
const spiritSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32,
  },
  types: {
    type: [String],
    default: [],
    validate: {
      validator: (v) => v.length <= 2 && v.every((t) => t && t.length <= 16),
      message: '最多2个属性，每个不超过16字符',
    },
  },
  // 种族值（与宝可梦一致：HP、攻击、防御、特攻、特防、速度）
  stats: {
    hp: { type: Number, default: 50, min: 1, max: 255 },
    attack: { type: Number, default: 50, min: 1, max: 255 },
    defense: { type: Number, default: 50, min: 1, max: 255 },
    sp_attack: { type: Number, default: 50, min: 1, max: 255 },
    sp_defense: { type: Number, default: 50, min: 1, max: 255 },
    speed: { type: Number, default: 50, min: 1, max: 255 },
  },
  description: {
    type: String,
    default: '',
    maxlength: 512,
  },
  image: {
    type: String,
    default: '',
    maxlength: 512,
  },
  // 关联：妖灵可学习的技能（ObjectId 引用 Skill）
  skills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
  }],
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

spiritSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Spirit = mongoose.model('Spirit', spiritSchema);

module.exports = Spirit;
