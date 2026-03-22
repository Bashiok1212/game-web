const mongoose = require('mongoose');

/**
 * 单张卡牌的入库 / 出库登记（每条记录一次操作，不涉及张数累加）
 */
const ptcgStockMovementSchema = new mongoose.Schema(
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
    type: { type: String, enum: ['in', 'out'], required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

ptcgStockMovementSchema.index({ admin: 1, createdAt: -1 });
ptcgStockMovementSchema.index({ admin: 1, card: 1, createdAt: -1 });

module.exports = mongoose.model('PtcgStockMovement', ptcgStockMovementSchema);
