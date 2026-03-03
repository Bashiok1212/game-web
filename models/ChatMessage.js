const mongoose = require('mongoose');

// 聊天消息：简单全球频道（后续可按频道/队伍扩展）
const chatMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  channel: {
    type: Number,
    min: 0,
    max: 4,
    default: 0, // 0=世界, 1=队伍, 2=公会, 3=私聊, 4=系统
  },
  senderName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;

