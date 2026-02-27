const mongoose = require('mongoose');

// 管理操作日志
const adminLogSchema = new mongoose.Schema({
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  operatorName: { type: String, default: '' },
  action: {
    type: String,
    required: true,
    enum: ['login', 'user_role', 'user_delete', 'spirit', 'skill', 'item', 'character', 'player_item', 'festival'],
  },
  detail: { type: String, default: '' },
  targetId: { type: String, default: '' },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

adminLogSchema.index({ created_at: -1 });
adminLogSchema.index({ action: 1, created_at: -1 });

const AdminLog = mongoose.model('AdminLog', adminLogSchema);

module.exports = AdminLog;
