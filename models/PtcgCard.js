const mongoose = require('mongoose');

const ptcgCardSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgAdmin',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 128 },
    set: { type: String, trim: true, maxlength: 128, default: '' },
    quantity: { type: Number, default: 1, min: 0 },
    condition: { type: String, trim: true, maxlength: 64, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

ptcgCardSchema.index({ admin: 1, updatedAt: -1 });

module.exports = mongoose.model('PtcgCard', ptcgCardSchema);
