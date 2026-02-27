const mongoose = require('mongoose');

// 角色模型 - 每个账号最多 3 个角色（角色位 1、2、3）
const characterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  slot: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20,
  },
  gold: { type: Number, default: 0 },
  rp: { type: Number, default: 0 },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

characterSchema.index({ user: 1, slot: 1 }, { unique: true });

characterSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const Character = mongoose.model('Character', characterSchema);

module.exports = Character;
