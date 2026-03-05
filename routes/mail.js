const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Mail = require('../models/Mail');
const PlayerItem = require('../models/PlayerItem');
const Character = require('../models/Character');

// 获取未读邮件数量（按角色维度）
// GET /api/mail/unread-count?characterId=xxx
router.get('/mail/unread-count', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.query;
    const filter = { user: req.user.id, isRead: false };
    if (characterId) {
      filter.character = characterId;
    }
    const unread = await Mail.countDocuments(filter);
    res.json({ ok: true, unread });
  } catch (err) {
    console.error('Mail unread-count error:', err.message);
    res.status(500).json({ error: '获取未读邮件失败' });
  }
});

// 获取邮件列表（最近 N 条，按角色维度）
// GET /api/mail/list?characterId=xxx&limit=50
router.get('/mail/list', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.query;
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 50;
    const filter = { user: req.user.id };
    if (characterId) filter.character = characterId;
    const list = await Mail.find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('attachments.item', 'number name image')
      .lean();
    const mails = list.map((m) => ({
      id: m._id.toString(),
      title: m.title,
      content: m.content,
      isRead: !!m.isRead,
      created_at: (m.created_at || new Date()).toISOString(),
      read_at: m.read_at ? m.read_at.toISOString() : null,
      attachments: (m.attachments || []).map((a) => ({
        id: a._id?.toString(),
        itemId: a.item?._id?.toString() || null,
        itemNumber: a.item?.number || 0,
        itemName: a.item?.name || '',
        itemImage: a.item?.image || '',
        quantity: a.quantity || 0,
        claimed: !!a.claimed,
      })),
    }));
    res.json({ ok: true, mails });
  } catch (err) {
    console.error('Mail list error:', err.message);
    res.status(500).json({ error: '获取邮件列表失败' });
  }
});

// 标记单封邮件为已读
// POST /api/mail/:id/read
router.post('/mail/:id/read', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const mail = await Mail.findOne({ _id: id, user: req.user.id });
    if (!mail) return res.status(404).json({ error: '邮件不存在' });
    if (!mail.isRead) {
      mail.isRead = true;
      mail.read_at = new Date();
      await mail.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Mail mark-read error:', err.message);
    res.status(500).json({ error: '标记已读失败' });
  }
});

// 领取附件：将未领取的附件发放到角色背包
// POST /api/mail/:id/claim
router.post('/mail/:id/claim', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const mail = await Mail.findOne({ _id: id, user: req.user.id })
      .populate('character', '_id user')
      .populate('attachments.item', '_id number name');
    if (!mail) return res.status(404).json({ error: '邮件不存在' });
    if (!mail.character) return res.status(400).json({ error: '邮件未绑定角色' });

    const characterId = mail.character._id;
    const character = await Character.findOne({ _id: characterId, user: req.user.id });
    if (!character) return res.status(403).json({ error: '无权领取该角色的附件' });

    const attachments = mail.attachments || [];
    const pending = attachments.filter((a) => !a.claimed && a.item && a.quantity > 0);
    if (pending.length === 0) {
      return res.json({ ok: true, message: '没有可领取的附件', alreadyClaimed: true });
    }

    const results = [];
    for (const att of pending) {
      const itemId = att.item._id;
      let pi = await PlayerItem.findOne({ character: characterId, item: itemId });
      if (!pi) {
        pi = await PlayerItem.create({
          character: characterId,
          item: itemId,
          quantity: att.quantity,
        });
      } else {
        pi.quantity += att.quantity;
        await pi.save();
      }
      att.claimed = true;
      att.claimed_at = new Date();
      results.push({ itemId: itemId.toString(), quantity: att.quantity });
    }

    mail.isRead = true;
    if (!mail.read_at) mail.read_at = new Date();
    await mail.save();

    res.json({ ok: true, received: results });
  } catch (err) {
    console.error('Mail claim error:', err.message);
    res.status(500).json({ error: '领取附件失败' });
  }
});

module.exports = router;

