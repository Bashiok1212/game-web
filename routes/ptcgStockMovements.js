const express = require('express');
const mongoose = require('mongoose');
const PtcgCard = require('../models/PtcgCard');
const PtcgStockMovement = require('../models/PtcgStockMovement');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

function movementToClient(doc, card) {
  const id = doc._id ? doc._id.toString() : String(doc.id);
  const createdAt = doc.createdAt
    ? doc.createdAt.toISOString
      ? doc.createdAt.toISOString()
      : doc.createdAt
    : undefined;
  const c = card || doc.card || {};
  const cid = doc.card && doc.card._id ? doc.card._id.toString() : doc.card ? String(doc.card) : '';
  return {
    id,
    type: doc.type,
    note: doc.note || '',
    createdAt,
    cardId: cid,
    cardNo: c.cardNo != null ? c.cardNo : null,
    cardName: c.name || '',
  };
}

/** POST /api/ptcg/cards/:id/stock-movement — body: { type: 'in'|'out', note?: string, cardStatus?: string } */
router.post('/cards/:id/stock-movement', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const body = req.body || {};
    const type = body.type === 'out' ? 'out' : 'in';
    const note = body.note != null ? String(body.note).trim().slice(0, 500) : '';
    const cardStatus =
      body.cardStatus != null && String(body.cardStatus).trim()
        ? String(body.cardStatus).trim().slice(0, 32)
        : null;

    const card = await PtcgCard.findOne({ _id: id, admin: req.ptcgAdminId }).lean();
    if (!card) return res.status(404).json({ error: '卡牌不存在' });

    const oid = new mongoose.Types.ObjectId(req.ptcgAdminId);
    const cardOid = new mongoose.Types.ObjectId(id);

    const mov = await PtcgStockMovement.create({
      admin: oid,
      card: cardOid,
      type,
      note,
    });

    if (cardStatus !== null) {
      await PtcgCard.updateOne({ _id: id, admin: req.ptcgAdminId }, { $set: { cardStatus } });
    }

    const lean = mov.toObject ? mov.toObject() : mov;
    const cardOut = { ...card };
    if (cardStatus !== null) cardOut.cardStatus = cardStatus;
    res.status(201).json({
      ok: true,
      movement: movementToClient(lean, cardOut),
    });
  } catch (e) {
    console.error('ptcg stock-movement post', e);
    res.status(500).json({ error: '登记失败' });
  }
});

/** GET /api/ptcg/cards/:id/stock-movements — 单卡流水 */
router.get('/cards/:id/stock-movements', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const exists = await PtcgCard.findOne({ _id: id, admin: req.ptcgAdminId }).select('_id').lean();
    if (!exists) return res.status(404).json({ error: '卡牌不存在' });

    let limit = parseInt(req.query.limit, 10);
    if (Number.isNaN(limit) || limit < 1) limit = 100;
    if (limit > 200) limit = 200;

    const list = await PtcgStockMovement.find({ admin: req.ptcgAdminId, card: id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('card', 'name cardNo')
      .lean();

    const card = await PtcgCard.findOne({ _id: id, admin: req.ptcgAdminId }).select('name cardNo').lean();
    res.json({
      movements: list.map((m) => movementToClient(m, m.card || card)),
    });
  } catch (e) {
    console.error('ptcg card stock-movements', e);
    res.status(500).json({ error: '读取失败' });
  }
});

/** GET /api/ptcg/stock-movements — 全部明细（当前管理员） */
router.get('/stock-movements', ptcgAuthMiddleware, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10);
    let skip = parseInt(req.query.skip, 10);
    if (Number.isNaN(limit) || limit < 1) limit = 100;
    if (limit > 200) limit = 200;
    if (Number.isNaN(skip) || skip < 0) skip = 0;

    const filter = { admin: req.ptcgAdminId };
    if (req.query.cardId && mongoose.Types.ObjectId.isValid(req.query.cardId)) {
      filter.card = req.query.cardId;
    }

    const [list, total] = await Promise.all([
      PtcgStockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('card', 'name cardNo')
        .lean(),
      PtcgStockMovement.countDocuments(filter),
    ]);

    res.json({
      movements: list.map((m) => movementToClient(m, m.card)),
      total,
      limit,
      skip,
    });
  } catch (e) {
    console.error('ptcg stock-movements', e);
    res.status(500).json({ error: '读取失败' });
  }
});

module.exports = router;
