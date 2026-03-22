const express = require('express');
const mongoose = require('mongoose');
const PtcgFieldDropdownConfig = require('../models/PtcgFieldDropdownConfig');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

/** 简单数组字段（不含 version：版本按语言分桶） */
const ARRAY_KEYS = ['cardStatus', 'language', 'rarity', 'condition'];

/** 兼容旧数据：全局 version 列表（无 versionByLanguage 时使用） */
const LEGACY_VERSION_KEY = 'version';

const DEFAULT_CARD_STATUS = ['在库', '已售', '出借', '送评中', '其他'];

const MAX_OPTS = 64;
const MAX_LEN = 128;
const MAX_LANG_KEYS = 48;

function sanitizeOptions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x).trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_OPTS);
}

function sanitizeVersionByLanguage(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (n >= MAX_LANG_KEYS) break;
    const key = String(k).trim().slice(0, MAX_LEN);
    if (!key) continue;
    out[key] = sanitizeOptions(v);
    n += 1;
  }
  return out;
}

/** 合并后供卡牌录入页 */
function getMergedDropdowns(doc) {
  const d = doc && doc.dropdowns && typeof doc.dropdowns === 'object' ? doc.dropdowns : {};
  const out = {};

  for (const k of ARRAY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = k === 'cardStatus' ? DEFAULT_CARD_STATUS.slice() : [];
    } else {
      const arr = d[k];
      out[k] = Array.isArray(arr) ? arr : [];
    }
  }

  if (!Object.prototype.hasOwnProperty.call(d, LEGACY_VERSION_KEY)) {
    out[LEGACY_VERSION_KEY] = [];
  } else {
    const arr = d[LEGACY_VERSION_KEY];
    out[LEGACY_VERSION_KEY] = Array.isArray(arr) ? arr : [];
  }

  if (!Object.prototype.hasOwnProperty.call(d, 'versionByLanguage')) {
    out.versionByLanguage = {};
  } else {
    const raw = d.versionByLanguage;
    out.versionByLanguage =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? sanitizeVersionByLanguage(raw) : {};
  }

  return out;
}

/** 编辑页：仅返回已保存的键 */
function getRawDropdowns(doc) {
  const d = doc && doc.dropdowns && typeof doc.dropdowns === 'object' ? doc.dropdowns : {};
  const out = {};
  for (const k of ARRAY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = Array.isArray(d[k]) ? d[k] : [];
    }
  }
  if (Object.prototype.hasOwnProperty.call(d, LEGACY_VERSION_KEY)) {
    out[LEGACY_VERSION_KEY] = Array.isArray(d[LEGACY_VERSION_KEY]) ? d[LEGACY_VERSION_KEY] : [];
  }
  if (Object.prototype.hasOwnProperty.call(d, 'versionByLanguage')) {
    const raw = d.versionByLanguage;
    out.versionByLanguage =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? sanitizeVersionByLanguage(raw) : {};
  }
  return out;
}

const FIELD_KEYS_META = [...ARRAY_KEYS, LEGACY_VERSION_KEY, 'versionByLanguage'];

router.get('/field-dropdowns', ptcgAuthMiddleware, async (req, res) => {
  try {
    const doc = await PtcgFieldDropdownConfig.findOne({ admin: req.ptcgAdminId }).lean();
    if (req.query.raw === '1' || req.query.raw === 'true') {
      return res.json({ dropdowns: getRawDropdowns(doc), fieldKeys: FIELD_KEYS_META });
    }
    res.json({ dropdowns: getMergedDropdowns(doc), fieldKeys: FIELD_KEYS_META });
  } catch (e) {
    console.error('ptcg field-dropdowns get', e);
    res.status(500).json({ error: '读取失败' });
  }
});

router.put('/field-dropdowns', ptcgAuthMiddleware, async (req, res) => {
  try {
    const body = req.body && req.body.dropdowns ? req.body.dropdowns : {};
    const merged = {};

    for (const k of ARRAY_KEYS) {
      merged[k] = body[k] !== undefined ? sanitizeOptions(body[k]) : [];
    }

    merged[LEGACY_VERSION_KEY] =
      body[LEGACY_VERSION_KEY] !== undefined ? sanitizeOptions(body[LEGACY_VERSION_KEY]) : [];

    merged.versionByLanguage =
      body.versionByLanguage !== undefined ? sanitizeVersionByLanguage(body.versionByLanguage) : {};

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
