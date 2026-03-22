const express = require('express');
const mongoose = require('mongoose');
const PtcgCard = require('../models/PtcgCard');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

function toClient(c) {
  if (!c) return null;
  var id = c._id ? (c._id.toString ? c._id.toString() : String(c._id)) : c.id;
  function iso(d) {
    if (!d) return undefined;
    return d.toISOString ? d.toISOString() : d;
  }
  return {
    id: id,
    name: c.name,
    set: c.set || '',
    quantity: c.quantity != null ? c.quantity : 1,
    condition: c.condition || '',
    notes: c.notes || '',
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

/** GET /api/ptcg/cards */
router.get('/cards', ptcgAuthMiddleware, async (req, res) => {
  try {
    const list = await PtcgCard.find({ admin: req.ptcgAdminId })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ cards: list.map(toClient) });
  } catch (e) {
    console.error('ptcg list cards', e);
    res.status(500).json({ error: '读取失败' });
  }
});

/** POST /api/ptcg/cards */
router.post('/cards', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { name, set, quantity, condition, notes } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: '名称必填' });
    }
    const card = await PtcgCard.create({
      admin: req.ptcgAdminId,
      name: String(name).trim().slice(0, 128),
      set: set != null ? String(set).slice(0, 128) : '',
      quantity: Math.max(0, parseInt(quantity, 10) || 0),
      condition: condition != null ? String(condition).slice(0, 64) : '',
      notes: notes != null ? String(notes).slice(0, 2000) : '',
    });
    res.status(201).json({ card: toClient(card.toObject ? card.toObject() : card) });
  } catch (e) {
    console.error('ptcg create card', e);
    res.status(500).json({ error: '创建失败' });
  }
});

/** PUT /api/ptcg/cards/:id */
router.put('/cards/:id', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const { name, set, quantity, condition, notes } = req.body || {};
    const update = {};
    if (name !== undefined) update.name = String(name).trim().slice(0, 128);
    if (set !== undefined) update.set = String(set).slice(0, 128);
    if (quantity !== undefined) update.quantity = Math.max(0, parseInt(quantity, 10) || 0);
    if (condition !== undefined) update.condition = String(condition).slice(0, 64);
    if (notes !== undefined) update.notes = String(notes).slice(0, 2000);
    if (update.name === '') return res.status(400).json({ error: '名称不能为空' });

    const card = await PtcgCard.findOneAndUpdate(
      { _id: id, admin: req.ptcgAdminId },
      { $set: update },
      { new: true, lean: true }
    );
    if (!card) return res.status(404).json({ error: '卡牌不存在' });
    res.json({ card: toClient(card) });
  } catch (e) {
    console.error('ptcg update card', e);
    res.status(500).json({ error: '更新失败' });
  }
});

/** DELETE /api/ptcg/cards/:id */
router.delete('/cards/:id', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const r = await PtcgCard.deleteOne({ _id: id, admin: req.ptcgAdminId });
    if (r.deletedCount === 0) return res.status(404).json({ error: '卡牌不存在' });
    res.json({ ok: true });
  } catch (e) {
    console.error('ptcg delete card', e);
    res.status(500).json({ error: '删除失败' });
  }
});

/** POST /api/ptcg/cards/import — body: { items: [...] } 或数组，合并导入 */
router.post('/cards/import', ptcgAuthMiddleware, async (req, res) => {
  try {
    let items = req.body.items;
    if (items == null && Array.isArray(req.body)) items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '格式应为数组或 { items: [] }' });
    }
    let created = 0;
    let updated = 0;
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.name) continue;
      const name = String(item.name).trim().slice(0, 128);
      if (!name) continue;
      const payload = {
        name,
        set: item.set != null ? String(item.set).slice(0, 128) : '',
        quantity: Math.max(0, parseInt(item.quantity, 10) || 0),
        condition: item.condition != null ? String(item.condition).slice(0, 64) : '',
        notes: item.notes != null ? String(item.notes).slice(0, 2000) : '',
      };
      const oid = item.id && mongoose.Types.ObjectId.isValid(item.id) ? item.id : null;
      if (oid) {
        const ex = await PtcgCard.findOne({ _id: oid, admin: req.ptcgAdminId });
        if (ex) {
          await PtcgCard.updateOne({ _id: oid, admin: req.ptcgAdminId }, { $set: payload });
          updated++;
          continue;
        }
      }
      await PtcgCard.create({ admin: req.ptcgAdminId, ...payload });
      created++;
    }
    res.json({ ok: true, created, updated });
  } catch (e) {
    console.error('ptcg import', e);
    res.status(500).json({ error: '导入失败' });
  }
});

module.exports = router;
