const express = require('express');
const mongoose = require('mongoose');
const PtcgFieldDropdownConfig = require('../models/PtcgFieldDropdownConfig');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

const FIELD_KEYS = ['cardStatus', 'language', 'rarity', 'condition', 'version'];

const DEFAULT_CARD_STATUS = ['在库', '已售', '出借', '送评中', '其他'];

const MAX_OPTS = 64;
const MAX_LEN = 128;

function sanitizeOptions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x).trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_OPTS);
}

/** 合并后供卡牌录入页：cardStatus 未配置时用默认列表 */
function getMergedDropdowns(doc) {
  const d = doc && doc.dropdowns && typeof doc.dropdowns === 'object' ? doc.dropdowns : {};
  const out = {};
  for (const k of FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = k === 'cardStatus' ? DEFAULT_CARD_STATUS.slice() : [];
    } else {
      const arr = d[k];
      out[k] = Array.isArray(arr) ? arr : [];
    }
  }
  return out;
}

/** 编辑页用：仅返回已保存的键 */
function getRawDropdowns(doc) {
  const d = doc && doc.dropdowns && typeof doc.dropdowns === 'object' ? doc.dropdowns : {};
  const out = {};
  for (const k of FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = Array.isArray(d[k]) ? d[k] : [];
    }
  }
  return out;
}

/** GET /api/ptcg/field-dropdowns?raw=1 编辑页；否则合并默认值（卡牌录入） */
router.get('/field-dropdowns', ptcgAuthMiddleware, async (req, res) => {
  try {
    const doc = await PtcgFieldDropdownConfig.findOne({ admin: req.ptcgAdminId }).lean();
    if (req.query.raw === '1' || req.query.raw === 'true') {
      return res.json({ dropdowns: getRawDropdowns(doc), fieldKeys: FIELD_KEYS });
    }
    res.json({ dropdowns: getMergedDropdowns(doc), fieldKeys: FIELD_KEYS });
  } catch (e) {
    console.error('ptcg field-dropdowns get', e);
    res.status(500).json({ error: '读取失败' });
  }
});

/** PUT /api/ptcg/field-dropdowns — 保存全部字段的下拉选项 */
router.put('/field-dropdowns', ptcgAuthMiddleware, async (req, res) => {
  try {
    const body = req.body && req.body.dropdowns ? req.body.dropdowns : {};
    const merged = {};
    for (const k of FIELD_KEYS) {
      merged[k] = body[k] !== undefined ? sanitizeOptions(body[k]) : [];
    }
    const oid = new mongoose.Types.ObjectId(req.ptcgAdminId);
    await PtcgFieldDropdownConfig.findOneAndUpdate(
      { admin: oid },
      { $set: { dropdowns: merged }, $setOnInsert: { admin: oid } },
      { upsert: true, new: true }
    );
    const saved = await PtcgFieldDropdownConfig.findOne({ admin: oid }).lean();
    res.json({ ok: true, dropdowns: getMergedDropdowns(saved), raw: getRawDropdowns(saved) });
  } catch (e) {
    console.error('ptcg field-dropdowns put', e);
    res.status(500).json({ error: '保存失败' });
  }
});

module.exports = router;
