const mongoose = require('mongoose');

// 玩家邮件：系统或管理员发给玩家角色的离线消息
const mailSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // 所属角色（按角色维度发邮件）
  character: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Character',
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 64,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
  read_at: {
    type: Date,
  },
});

const Mail = mongoose.model('Mail', mailSchema);

module.exports = Mail;

