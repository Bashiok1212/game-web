const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Mail = require('../models/Mail');

// 获取未读邮件数量
// GET /api/mail/unread-count
router.get('/mail/unread-count', authMiddleware, async (req, res) => {
  try {
    const unread = await Mail.countDocuments({ user: req.user.id, isRead: false });
    res.json({ ok: true, unread });
  } catch (err) {
    console.error('Mail unread-count error:', err.message);
    res.status(500).json({ error: '获取未读邮件失败' });
  }
});

// 获取邮件列表（最近 N 条）
// GET /api/mail/list?limit=50
router.get('/mail/list', authMiddleware, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 50;
    const list = await Mail.find({ user: req.user.id })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    const mails = list.map((m) => ({
      id: m._id.toString(),
      title: m.title,
      content: m.content,
      isRead: !!m.isRead,
      created_at: (m.created_at || new Date()).toISOString(),
      read_at: m.read_at ? m.read_at.toISOString() : null,
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

module.exports = router;

