const mongoose = require('mongoose');

// 技能模型 - 宝可梦风格（编号、名称、属性、类型、威力、命中、PP等）
const skillSchema = new mongoose.Schema({
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
  type: {
    type: String,
    default: '',
    maxlength: 16,
  },
  category: {
    type: String,
    enum: ['物理', '特殊', '变化', ''],
    default: '',
  },
  power: {
    type: Number,
    default: 0,
    min: 0,
    max: 300,
  },
  accuracy: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },
  pp: {
    type: Number,
    default: 10,
    min: 1,
    max: 40,
  },
  description: {
    type: String,
    default: '',
    maxlength: 512,
  },
  effect: {
    type: String,
    default: '',
    maxlength: 256,
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

skillSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Skill = mongoose.model('Skill', skillSchema);

module.exports = Skill;
