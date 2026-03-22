const express = require('express');
const mongoose = require('mongoose');
const PtcgCard = require('../models/PtcgCard');
const PtcgStockLog = require('../models/PtcgStockLog');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

const MAX_QTY_OP = 999999;

function logToClient(doc) {
  if (!doc) return null;
  const id = doc._id ? doc._id.toString() : String(doc.id);
  const createdAt = doc.createdAt
    ? doc.createdAt.toISOString
      ? doc.createdAt.toISOString()
      : doc.createdAt
    : undefined;
  return {
    id,
    type: doc.type,
    quantity: doc.quantity,
    balanceAfter: doc.balanceAfter,
    note: doc.note || '',
    createdAt,
  };
}

/** POST /api/ptcg/cards/:id/stock — body: { type: 'in'|'out', quantity: number, note?: string } */
router.post('/cards/:id/stock', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const body = req.body || {};
    const type = body.type === 'out' ? 'out' : 'in';
    let qty = parseInt(body.quantity, 10);
    if (Number.isNaN(qty) || qty < 1 || qty > MAX_QTY_OP) {
      return res.status(400).json({ error: '数量须为 1～' + MAX_QTY_OP + ' 的整数' });
    }
    const note = body.note != null ? String(body.note).trim().slice(0, 500) : '';

    const oid = new mongoose.Types.ObjectId(req.ptcgAdminId);
    const cardId = new mongoose.Types.ObjectId(id);

    /** 用管道更新，兼容 quantity 缺失；库存按 0 起算（与 min:0 一致） */
    let card;
    if (type === 'in') {
      card = await PtcgCard.findOneAndUpdate(
        { _id: cardId, admin: oid },
        [{ $set: { quantity: { $add: [{ $ifNull: ['$quantity', 0] }, qty] } } }],
        { new: true, lean: true }
      );
    } else {
      card = await PtcgCard.findOneAndUpdate(
        {
          _id: cardId,
          admin: oid,
          $expr: { $gte: [{ $ifNull: ['$quantity', 0] }, qty] },
        },
        [{ $set: { quantity: { $subtract: [{ $ifNull: ['$quantity', 0] }, qty] } } }],
        { new: true, lean: true }
      );
    }

    if (!card) {
      const exists = await PtcgCard.findOne({ _id: cardId, admin: oid }).lean();
      if (!exists) return res.status(404).json({ error: '卡牌不存在' });
      return res.status(400).json({ error: '出库数量超过当前库存' });
    }

    const balanceAfter = card.quantity != null ? card.quantity : 0;

    const log = await PtcgStockLog.create({
      admin: oid,
      card: cardId,
      type,
      quantity: qty,
      balanceAfter,
      note,
    });

    res.json({
      ok: true,
      card: {
        id: card._id.toString(),
        quantity: balanceAfter,
      },
      log: logToClient(log.toObject ? log.toObject() : log),
    });
  } catch (e) {
    console.error('ptcg stock', e);
    res.status(500).json({ error: '操作失败' });
  }
});

/** GET /api/ptcg/cards/:id/stock-logs?limit=50&skip=0 */
router.get('/cards/:id/stock-logs', ptcgAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: '无效 ID' });
    }
    const card = await PtcgCard.findOne({
      _id: id,
      admin: req.ptcgAdminId,
    })
      .select('_id')
      .lean();
    if (!card) return res.status(404).json({ error: '卡牌不存在' });

    let limit = parseInt(req.query.limit, 10);
    let skip = parseInt(req.query.skip, 10);
    if (Number.isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;
    if (Number.isNaN(skip) || skip < 0) skip = 0;

    const logs = await PtcgStockLog.find({ admin: req.ptcgAdminId, card: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ logs: logs.map(logToClient) });
  } catch (e) {
    console.error('ptcg stock-logs', e);
    res.status(500).json({ error: '读取失败' });
  }
});

module.exports = router;
