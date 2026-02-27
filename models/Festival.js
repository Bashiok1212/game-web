const mongoose = require('mongoose');

// 节日模型 - 用于活动 Buff 加成
const festivalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 64,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  shineRateBoost: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
  goldBoost: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
  expBoost: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
  captureRateBoost: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
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

festivalSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Festival = mongoose.model('Festival', festivalSchema);

module.exports = Festival;
