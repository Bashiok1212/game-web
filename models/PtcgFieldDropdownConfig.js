const mongoose = require('mongoose');

/** 现有录入字段的下拉选项（每个 PTCG 管理员一份） */
const ptcgFieldDropdownConfigSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PtcgAdmin',
      required: true,
      unique: true,
      index: true,
    },
    /** 仅允许：cardStatus, language, rarity, condition, version；值为字符串数组，空数组表示该字段用手输 */
    dropdowns: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PtcgFieldDropdownConfig', ptcgFieldDropdownConfigSchema);
