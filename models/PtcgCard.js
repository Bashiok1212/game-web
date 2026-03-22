const mongoose = require('mongoose');

/** PTCG 个人卡牌：编号 cardNo 按管理员自增；保留 set/quantity 兼容旧数据 */
const ptcgCardSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgAdmin',
      required: true,
      index: true,
    },
    cardNo: {
      type: Number,
      min: 1,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    year: { type: Number, min: 0, max: 9999 },
    language: { type: String, trim: true, maxlength: 32, default: '' },
    version: { type: String, trim: true, maxlength: 128, default: '' },
    rarity: { type: String, trim: true, maxlength: 64, default: '' },
    purchasePrice: { type: Number, min: 0, default: 0 },
    graded: { type: Boolean, default: false },
    gradingCompany: { type: String, trim: true, maxlength: 64, default: '' },
    gradingNumber: { type: String, trim: true, maxlength: 64, default: '' },
    condition: { type: String, trim: true, maxlength: 64, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    cardStatus: { type: String, trim: true, maxlength: 32, default: '' },
    /** 图片：外链 URL 或 data:image/... Base64（勿过大） */
    image: { type: String, maxlength: 600000, default: '' },
    /** 兼容旧字段 */
    set: { type: String, trim: true, maxlength: 128, default: '' },
    quantity: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true }
);

ptcgCardSchema.index({ admin: 1, updatedAt: -1 });
ptcgCardSchema.index({ admin: 1, cardNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PtcgCard', ptcgCardSchema);
