const express = require('express');
const mongoose = require('mongoose');
const PtcgFieldDef = require('../models/PtcgFieldDef');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();
const MAX_FIELDS = 50;

const KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

function toClient(d) {
  return {
    id: d._id.toString(),
    key: d.key,
    label: d.label,
    type: d.type,
    order: d.order != null ? d.order : 0,
    required: !!d.required,
    options: Array.isArray(d.options) ? d.options : [],
    createdAt: d.createdAt ? d.createdAt.toISOString() : undefined,
    updatedAt: d.updatedAt ? d.updatedAt.toISOString() : undefined,
  };
}

/** GET /api/ptcg/field-defs */
router.get('/field-defs', ptcgAuthMiddleware, async (req, res) => {
  try {
    const list = await PtcgFieldDef.find({ admin: req.ptcgAdminId })
      .sort({ order: 1, _id: 1 })
      .lean();
    res.json({ fieldDefs: list.map(toClient) });
  } catch (e) {
    console.error('ptcg field-defs list', e);
    res.status(500).json({ error: '读取失败' });
  }
});

/** POST /api/ptcg/field-defs */
router.post('/field-defs', ptcgAuthMiddleware, async (req, res) => {
  try {
    const n = await PtcgFieldDef.countDocuments({ admin: req.ptcgAdminId });
    if (n >= MAX_FIELDS) {
      return res.status(400).json({ error: '自定义字段最多 ' + MAX_FIELDS + ' 个' });
    }
    const { key, label, type, order, required, options } = req.body || {};
    const k = key != null ? String(key).trim().toLowerCase() : '';
    if (!KEY_RE.test(k)) {
      return res.status(400).json({
        error: '标识须为小写字母开头，仅含小写字母、数字、下划线，最长 32 位',
      });
    }
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: '请填写显示名称' });
    }
    const t = ['text', 'textarea', 'number', 'select'].includes(type) ? type : 'text';
    let opts = [];
    if (t === 'select' && options != null) {
      if (Array.isArray(options)) {
        opts = options.map((x) => String(x).trim()).filter(Boolean).slice(0, 64);
      } else if (typeof options === 'string') {
        opts = options
          .split(/[\n,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 64);
      }
      if (opts.length === 0) {
        return res.status(400).json({ error: '下拉类型请至少填写一个选项' });
      }
    }
    const doc = await PtcgFieldDef.create({
      admin: req.ptcgAdminId,
      key: k,
      label: String(label).trim().slice(0, 64),
      type: t,
      order: order != null ? parseInt(order, 10) || 0 : 0,
      required: !!required,
      options: opts,
    });
    res.status(201).json({ fieldDef: toClient(doc.toObject()) });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ error: '标识已存在' });
    }
    console.error('ptcg field-defs create', e);
    res.status(500).json({ error: '创建失败' });
  }
});

/** PUT /api/ptcg/field-defs/:id — 不可改 key */
router.put('/field-defs/:id', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const { label, type, order, required, options } = req.body || {};
    const update = {};
    if (label !== undefined) update.label = String(label).trim().slice(0, 64);
    if (type !== undefined) {
      update.type = ['text', 'textarea', 'number', 'select'].includes(type) ? type : 'text';
    }
    if (order !== undefined) update.order = parseInt(order, 10) || 0;
    if (required !== undefined) update.required = !!required;
    if (options !== undefined) {
      let opts = [];
      if (Array.isArray(options)) {
        opts = options.map((x) => String(x).trim()).filter(Boolean).slice(0, 64);
      } else if (typeof options === 'string') {
        opts = options
          .split(/[\n,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 64);
      }
      update.options = opts;
    }
    const t = update.type;
    const doc = await PtcgFieldDef.findOne({ _id: id, admin: req.ptcgAdminId });
    if (!doc) return res.status(404).json({ error: '不存在' });
    const finalType = t || doc.type;
    if (finalType === 'select') {
      const o = update.options !== undefined ? update.options : doc.options;
      if (!o || !o.length) {
        return res.status(400).json({ error: '下拉类型请至少保留一个选项' });
      }
    }
    Object.assign(doc, update);
    if (doc.type !== 'select') doc.options = [];
    await doc.save();
    res.json({ fieldDef: toClient(doc.toObject()) });
  } catch (e) {
    console.error('ptcg field-defs update', e);
    res.status(500).json({ error: '更新失败' });
  }
});

/** DELETE /api/ptcg/field-defs/:id */
router.delete('/field-defs/:id', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const r = await PtcgFieldDef.deleteOne({ _id: id, admin: req.ptcgAdminId });
    if (r.deletedCount === 0) return res.status(404).json({ error: '不存在' });
    res.json({ ok: true });
  } catch (e) {
    console.error('ptcg field-defs delete', e);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
