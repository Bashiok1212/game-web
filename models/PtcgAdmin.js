const mongoose = require('mongoose');

/**
 * PTCG 个人卡牌页管理员（与 User 游戏账号无关）
 */
const ptcgAdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 32,
  },
  password_hash: {
    type: String,
    required: true,
    select: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('PtcgAdmin', ptcgAdminSchema);
