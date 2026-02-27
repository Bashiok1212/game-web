const mongoose = require('mongoose');

const VALID_CATEGORIES = ['道具', '精灵球', '贵重物品', '药品', '商城', '时装'];

// 物品模型 - 宝可梦风格（编号、名称、类型、描述、效果等）
const itemSchema = new mongoose.Schema({
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
  category: {
    type: String,
    enum: ['道具', '精灵球', '贵重物品', '药品', '商城', '时装'],
    default: '道具',
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
  image: {
    type: String,
    default: '',
    maxlength: 512,
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

itemSchema.pre('save', function (next) {
  this.updated_at = new Date();
  if (this.category && !VALID_CATEGORIES.includes(this.category)) {
    this.category = '道具';
  }
  next();
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
