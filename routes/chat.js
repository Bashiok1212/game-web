const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const ChatMessage = require('../models/ChatMessage');

// 发送聊天消息
// POST /api/chat/send  body: { channel: 0-4, content: string }
router.post('/chat/send', authMiddleware, async (req, res) => {
  try {
    let { channel, content } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: '内容不能为空' });
    }
    content = String(content).trim();
    if (content.length > 200) content = content.slice(0, 200);

    let ch = Number.isInteger(channel) ? channel : 0;
    if (ch < 0 || ch > 4) ch = 0;

    const senderName = (req.user && req.user.username) ? String(req.user.username).slice(0, 32) : '玩家';

    const msg = await ChatMessage.create({
      user: req.user.id,
      channel: ch,
      senderName,
      content,
    });

    res.json({
      ok: true,
      message: {
        id: msg._id.toString(),
        channel: msg.channel,
        sender: msg.senderName,
        content: msg.content,
        created_at: msg.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error('Chat send error:', err.message);
    res.status(500).json({ error: '发送失败' });
  }
});

// 拉取聊天记录
// GET /api/chat/messages?since=ISO_STRING
router.get('/chat/messages', authMiddleware, async (req, res) => {
  try {
    const { since } = req.query;
    const query = {};
    if (since) {
      const t = new Date(since);
      if (!Number.isNaN(t.getTime())) {
        query.created_at = { $gt: t };
      }
    }
    const limit = 50;
    const list = await ChatMessage.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    list.reverse();
    const messages = list.map((m) => ({
      id: m._id.toString(),
      channel: m.channel,
      sender: m.senderName,
      content: m.content,
      created_at: m.created_at.toISOString(),
    }));
    res.json({ ok: true, messages });
  } catch (err) {
    console.error('Chat history error:', err.message);
    res.status(500).json({ error: '获取聊天记录失败' });
  }
});

module.exports = router;

