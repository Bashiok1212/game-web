const express = require('express');
const mongoose = require('mongoose');
const PtcgCard = require('../models/PtcgCard');
const { ptcgAuthMiddleware } = require('../middleware/ptcgAuth');

const router = express.Router();

const IMAGE_MAX = 600000;

function toClient(c) {
  if (!c) return null;
  var id = c._id ? (c._id.toString ? c._id.toString() : String(c._id)) : c.id;
  function iso(d) {
    if (!d) return undefined;
    return d.toISOString ? d.toISOString() : d;
  }
  return {
    id: id,
    cardNo: c.cardNo != null ? c.cardNo : null,
    name: c.name,
    year: c.year != null ? c.year : null,
    language: c.language || '',
    version: c.version || '',
    rarity: c.rarity || '',
    purchasePrice: c.purchasePrice != null ? c.purchasePrice : 0,
    graded: !!c.graded,
    gradingCompany: c.gradingCompany || '',
    gradingNumber: c.gradingNumber || '',
    condition: c.condition || '',
    notes: c.notes || '',
    cardStatus: c.cardStatus || '',
    image: c.image || '',
    set: c.set || '',
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

async function getMaxCardNo(adminId) {
  const oid = new mongoose.Types.ObjectId(adminId);
  const agg = await PtcgCard.aggregate([
    {
      $match: {
        admin: oid,
        cardNo: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: null, maxNo: { $max: '$cardNo' } } },
  ]);
  return agg[0] && agg[0].maxNo != null ? agg[0].maxNo : 0;
}

/** 为缺少 cardNo 的旧文档补号（按 _id 顺序接在最大号之后） */
async function ensureCardNosForAdmin(adminId) {
  const oid = new mongoose.Types.ObjectId(adminId);
  const missing = await PtcgCard.find({
    admin: oid,
    $or: [{ cardNo: { $exists: false } }, { cardNo: null }],
  })
    .sort({ _id: 1 })
    .select('_id')
    .lean();
  if (!missing.length) return;
  let next = (await getMaxCardNo(adminId)) + 1;
  for (const row of missing) {
    await PtcgCard.updateOne({ _id: row._id }, { $set: { cardNo: next } });
    next += 1;
  }
}

function parseYear(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0 || n > 9999) return undefined;
  return n;
}

function parsePrice(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeCreate(body) {
  const b = body || {};
  const image = b.image != null ? String(b.image) : '';
  if (image.length > IMAGE_MAX) {
    const err = new Error('图片数据过大');
    err.code = 'IMAGE_TOO_LARGE';
    throw err;
  }
  return {
    name: String(b.name || '').trim().slice(0, 128),
    year: parseYear(b.year),
    language: b.language != null ? String(b.language).slice(0, 32) : '',
    version: (function () {
      const v = b.version != null ? String(b.version).slice(0, 128) : '';
      if (v.trim()) return v;
      if (b.set != null && String(b.set).trim()) return String(b.set).slice(0, 128);
      return '';
    })(),
    rarity: b.rarity != null ? String(b.rarity).slice(0, 64) : '',
    purchasePrice: parsePrice(b.purchasePrice),
    graded: !!b.graded,
    gradingCompany: b.gradingCompany != null ? String(b.gradingCompany).slice(0, 64) : '',
    gradingNumber: b.gradingNumber != null ? String(b.gradingNumber).slice(0, 64) : '',
    condition: b.condition != null ? String(b.condition).slice(0, 64) : '',
    notes: b.notes != null ? String(b.notes).slice(0, 2000) : '',
    cardStatus: b.cardStatus != null ? String(b.cardStatus).slice(0, 32) : '',
    image,
    set: b.set != null ? String(b.set).slice(0, 128) : '',
  };
}

async function createCardWithNextNo(adminId, payload) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const cardNo = (await getMaxCardNo(adminId)) + 1;
    try {
      const card = await PtcgCard.create({
        admin: adminId,
        cardNo,
        ...payload,
      });
      return card;
    } catch (e) {
      if (e.code === 11000) continue;
      throw e;
    }
  }
  throw new Error('无法分配编号');
}

/** GET /api/ptcg/cards */
router.get('/cards', ptcgAuthMiddleware, async (req, res) => {
  try {
    await ensureCardNosForAdmin(req.ptcgAdminId);
    const list = await PtcgCard.find({ admin: req.ptcgAdminId })
      .sort({ cardNo: -1 })
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
    let payload;
    try {
      payload = normalizeCreate(req.body || {});
    } catch (err) {
      if (err.code === 'IMAGE_TOO_LARGE') {
        return res.status(400).json({ error: '图片数据过大，请压缩或使用外链' });
      }
      throw err;
    }
    if (!payload.name) {
      return res.status(400).json({ error: '名称必填' });
    }
    if (payload.graded) {
      if (!String(payload.gradingCompany || '').trim()) {
        return res.status(400).json({ error: '评级卡请填写评级公司' });
      }
      if (!String(payload.gradingNumber || '').trim()) {
        return res.status(400).json({ error: '评级卡请填写评级编号' });
      }
    } else {
      payload.gradingCompany = '';
      payload.gradingNumber = '';
    }

    const card = await createCardWithNextNo(req.ptcgAdminId, payload);
    const obj = card.toObject ? card.toObject() : card;
    res.status(201).json({ card: toClient(obj) });
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
    let payload;
    try {
      payload = normalizeCreate(req.body || {});
    } catch (err) {
      if (err.code === 'IMAGE_TOO_LARGE') {
        return res.status(400).json({ error: '图片数据过大，请压缩或使用外链' });
      }
      throw err;
    }
    if (!payload.name) {
      return res.status(400).json({ error: '名称不能为空' });
    }
    if (payload.graded) {
      if (!String(payload.gradingCompany || '').trim()) {
        return res.status(400).json({ error: '评级卡请填写评级公司' });
      }
      if (!String(payload.gradingNumber || '').trim()) {
        return res.status(400).json({ error: '评级卡请填写评级编号' });
      }
    } else {
      payload.gradingCompany = '';
      payload.gradingNumber = '';
    }

    const update = { ...payload };
    delete update.name;
    const card = await PtcgCard.findOneAndUpdate(
      { _id: id, admin: req.ptcgAdminId },
      { $set: { ...update, name: payload.name }, $unset: { quantity: '' } },
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

function itemToPayload(item) {
  const b = item || {};
  const image = b.image != null ? String(b.image) : '';
  if (image.length > IMAGE_MAX) return null;
  const name = String(b.name || '').trim().slice(0, 128);
  if (!name) return null;
  let graded = !!b.graded;
  let gc = b.gradingCompany != null ? String(b.gradingCompany).slice(0, 64) : '';
  let gn = b.gradingNumber != null ? String(b.gradingNumber).slice(0, 64) : '';
  if (graded && (!gc.trim() || !gn.trim())) {
    graded = false;
    gc = '';
    gn = '';
  }
  return {
    name,
    year: parseYear(b.year),
    language: b.language != null ? String(b.language).slice(0, 32) : '',
    version: (function () {
      const v = b.version != null ? String(b.version).slice(0, 128) : '';
      if (v.trim()) return v;
      if (b.set != null && String(b.set).trim()) return String(b.set).slice(0, 128);
      return '';
    })(),
    rarity: b.rarity != null ? String(b.rarity).slice(0, 64) : '',
    purchasePrice: parsePrice(b.purchasePrice),
    graded,
    gradingCompany: graded ? gc : '',
    gradingNumber: graded ? gn : '',
    condition: b.condition != null ? String(b.condition).slice(0, 64) : '',
    notes: b.notes != null ? String(b.notes).slice(0, 2000) : '',
    cardStatus: b.cardStatus != null ? String(b.cardStatus).slice(0, 32) : '',
    image,
    set: b.set != null ? String(b.set).slice(0, 128) : '',
  };
}

/** POST /api/ptcg/cards/import — body: { items: [...] } 或数组 */
router.post('/cards/import', ptcgAuthMiddleware, async (req, res) => {
  try {
    let items = req.body.items;
    if (items == null && Array.isArray(req.body)) items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '格式应为数组或 { items: [] }' });
    }
    await ensureCardNosForAdmin(req.ptcgAdminId);

    let created = 0;
    let updated = 0;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const payload = itemToPayload(item);
      if (!payload) continue;
      const oid = item.id && mongoose.Types.ObjectId.isValid(item.id) ? item.id : null;
      if (oid) {
        const ex = await PtcgCard.findOne({ _id: oid, admin: req.ptcgAdminId });
        if (ex) {
          await PtcgCard.updateOne(
            { _id: oid, admin: req.ptcgAdminId },
            { $set: payload }
          );
          updated++;
          continue;
        }
      }
      await createCardWithNextNo(req.ptcgAdminId, payload);
      created++;
    }
    res.json({ ok: true, created, updated });
  } catch (e) {
    console.error('ptcg import', e);
    res.status(500).json({ error: '导入失败' });
  }
});

module.exports = router;
