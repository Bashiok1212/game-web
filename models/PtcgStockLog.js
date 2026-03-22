const mongoose = require('mongoose');

/** 单张卡牌的入库 / 出库流水 */
const ptcgStockLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgAdmin',
      required: true,
      index: true,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgCard',
      required: true,
      index: true,
    },
    /** 入库增加、出库减少 */
    type: { type: String, enum: ['in', 'out'], required: true },
    /** 本次变动数量，正整数 */
    quantity: { type: Number, required: true, min: 1, max: 999999 },
    /** 变动后库存快照 */
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

ptcgStockLogSchema.index({ admin: 1, card: 1, createdAt: -1 });

module.exports = mongoose.model('PtcgStockLog', ptcgStockLogSchema);
