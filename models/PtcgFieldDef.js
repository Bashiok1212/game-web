const mongoose = require('mongoose');

/** 每张卡可扩展的自定义字段定义（按 PTCG 管理员隔离） */
const ptcgFieldDefSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgAdmin',
      required: true,
      index: true,
    },
    /** 英文标识，用于存库与 API，创建后不可改 */
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
      match: /^[a-z][a-z0-9_]{0,31}$/,
    },
    label: { type: String, required: true, trim: true, maxlength: 64 },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'select'],
      default: 'text',
    },
    order: { type: Number, default: 0 },
    required: { type: Boolean, default: false },
    /** type=select 时每行一项 */
    options: [{ type: String, trim: true, maxlength: 128 }],
  },
  { timestamps: true }
);

ptcgFieldDefSchema.index({ admin: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('PtcgFieldDef', ptcgFieldDefSchema);
