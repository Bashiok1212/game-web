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
    /**
     * cardStatus/language/rarity/condition: 字符串数组，空数组表示手输
     * version: 兼容旧数据，全局版本列表（无按语言配置时使用）
     * versionByLanguage: { [语言名]: string[] }，每种语言独立版本下拉
     */
    dropdowns: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PtcgFieldDropdownConfig', ptcgFieldDropdownConfigSchema);
