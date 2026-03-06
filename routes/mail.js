const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Mail = require('../models/Mail');
const PlayerItem = require('../models/PlayerItem');
const Character = require('../models/Character');
const wsHub = require('../wsHub');

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
      .populate('spirits.spirit', 'number name image types')
      .lean();
    const mails = list.map((m) => ({
      id: m._id.toString(),
      title: m.title,
      content: m.content,
      isRead: !!m.isRead,
      created_at: (m.created_at || new Date()).toISOString(),
      read_at: m.read_at ? m.read_at.toISOString() : null,
      attachments: (m.attachments || []).slice(0, 5).map((a) => ({
        id: a._id?.toString(),
        itemId: a.item?._id?.toString() || null,
        itemNumber: a.item?.number || 0,
        itemName: a.item?.name || '',
        itemImage: a.item?.image || '',
        quantity: a.quantity || 0,
        claimed: !!a.claimed,
      })),
      spirits: (m.spirits || []).slice(0, 5).map((s) => ({
        id: s._id?.toString(),
        spiritId: s.spirit?._id?.toString() || null,
        spiritNumber: s.spirit?.number || 0,
        spiritName: s.spirit?.name || '',
        spiritImage: s.spirit?.image || '',
        claimed: !!s.claimed,
      })),
      gold: Math.max(0, Number(m.gold) || 0),
      goldClaimed: !!m.goldClaimed,
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
    // WS 推送未读数更新（图标无需再轮询）
    try {
      const unread = await Mail.countDocuments({ user: req.user.id, character: mail.character, isRead: false });
      wsHub.notifyMailUnread(mail.character?.toString(), unread);
    } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Mail mark-read error:', err.message);
    res.status(500).json({ error: '标记已读失败' });
  }
});

// 领取附件：不传 body 或 body 无 slotType 则领取全部；传 slotType + slotIndex 则只领该格
// POST /api/mail/:id/claim   body 可选: { slotType: 'spirit'|'item'|'gold', slotIndex: 0 }
router.post('/mail/:id/claim', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { slotType, slotIndex } = req.body || {};
    const singleSlot = slotType === 'spirit' || slotType === 'item' || slotType === 'gold';

    const mail = await Mail.findOne({ _id: id, user: req.user.id })
      .populate('character', '_id user')
      .populate('attachments.item', '_id number name');
    if (!mail) return res.status(404).json({ error: '邮件不存在' });
    if (!mail.character) return res.status(400).json({ error: '邮件未绑定角色' });

    const characterId = mail.character._id;
    const character = await Character.findOne({ _id: characterId, user: req.user.id });
    if (!character) return res.status(403).json({ error: '无权领取该角色的附件' });

    const attachments = mail.attachments || [];
    const spirits = mail.spirits || [];
    const results = { items: [], gold: 0, spirits: 0 };

    if (singleSlot) {
      const idx = typeof slotIndex === 'number' ? Math.max(0, Math.min(4, Math.floor(slotIndex))) : 0;
      if (slotType === 'spirit') {
        const s = spirits[idx];
        if (!s || !s.spirit || s.claimed) {
          return res.json({ ok: true, message: '该格无可领取', alreadyClaimed: true, received: results });
        }
        s.claimed = true;
        s.claimed_at = new Date();
        results.spirits = 1;
      } else if (slotType === 'item') {
        const att = attachments[idx];
        if (!att || !att.item || att.quantity <= 0 || att.claimed) {
          return res.json({ ok: true, message: '该格无可领取', alreadyClaimed: true, received: results });
        }
        const itemId = att.item._id;
        let pi = await PlayerItem.findOne({ character: characterId, item: itemId });
        if (!pi) {
          pi = await PlayerItem.create({ character: characterId, item: itemId, quantity: att.quantity });
        } else {
          pi.quantity += att.quantity;
          await pi.save();
        }
        att.claimed = true;
        att.claimed_at = new Date();
        results.items.push({ itemId: itemId.toString(), quantity: att.quantity });
      } else if (slotType === 'gold') {
        if (mail.gold <= 0 || mail.goldClaimed) {
          return res.json({ ok: true, message: '该格无可领取', alreadyClaimed: true, received: results });
        }
        const goldToClaim = Math.max(0, Math.floor(Number(mail.gold) || 0));
        character.gold = (character.gold || 0) + goldToClaim;
        await character.save();
        mail.goldClaimed = true;
        mail.goldClaimedAt = new Date();
        results.gold = goldToClaim;
      }
    } else {
      const pendingItems = attachments.filter((a) => !a.claimed && a.item && a.quantity > 0);
      const goldToClaim = (mail.gold > 0 && !mail.goldClaimed) ? Math.max(0, Math.floor(Number(mail.gold) || 0)) : 0;
      const hasSpiritsToClaim = spirits.some((s) => s.spirit && !s.claimed);
      const nothingToClaim = pendingItems.length === 0 && goldToClaim === 0 && !hasSpiritsToClaim;
      if (nothingToClaim) {
        return res.json({ ok: true, message: '没有可领取的附件', alreadyClaimed: true, received: results });
      }
      for (const att of pendingItems) {
        const itemId = att.item._id;
        let pi = await PlayerItem.findOne({ character: characterId, item: itemId });
        if (!pi) {
          pi = await PlayerItem.create({ character: characterId, item: itemId, quantity: att.quantity });
        } else {
          pi.quantity += att.quantity;
          await pi.save();
        }
        att.claimed = true;
        att.claimed_at = new Date();
        results.items.push({ itemId: itemId.toString(), quantity: att.quantity });
      }
      if (goldToClaim > 0) {
        character.gold = (character.gold || 0) + goldToClaim;
        await character.save();
        mail.goldClaimed = true;
        mail.goldClaimedAt = new Date();
        results.gold = goldToClaim;
      }
      for (const s of spirits) {
        if (s.spirit && !s.claimed) {
          s.claimed = true;
          s.claimed_at = new Date();
          results.spirits += 1;
        }
      }
    }

    mail.isRead = true;
    if (!mail.read_at) mail.read_at = new Date();
    await mail.save();

    // WS 推送未读数更新（领取时也会置为已读）
    try {
      const unread = await Mail.countDocuments({ user: req.user.id, character: mail.character?._id || mail.character, isRead: false });
      wsHub.notifyMailUnread((mail.character?._id || mail.character)?.toString(), unread);
    } catch (_) {}

    res.json({ ok: true, received: results });
  } catch (err) {
    console.error('Mail claim error:', err.message);
    res.status(500).json({ error: '领取附件失败' });
  }
});

// 删除邮件（仅限当前用户自己的邮件）
// DELETE /api/mail/:id
router.delete('/mail/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const mail = await Mail.findOne({ _id: id, user: req.user.id });
    if (!mail) return res.status(404).json({ error: '邮件不存在' });
    await Mail.deleteOne({ _id: id, user: req.user.id });
    try {
      const unread = await Mail.countDocuments({ user: req.user.id, character: mail.character, isRead: false });
      wsHub.notifyMailUnread(mail.character?.toString(), unread);
    } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Mail delete error:', err.message);
    res.status(500).json({ error: '删除邮件失败' });
  }
});

module.exports = router;

