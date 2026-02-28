const express = require('express');
const Festival = require('../models/Festival');

const router = express.Router();

// 健康检查（用于验证部署是否包含 discard 等接口）
router.get('/health', (req, res) => {
  res.json({ ok: true, discard: 'POST /api/user/player-items/:id/discard' });
});

// 获取服务器时间（无需鉴权）
router.get('/time', (req, res) => {
  try {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const utc = now.toISOString();
    let utcFormatted, pacificFormatted;
    try {
      utcFormatted = now.toLocaleString('zh-CN', { timeZone: 'UTC' });
      pacificFormatted = now.toLocaleString('zh-CN', { timeZone: 'America/Los_Angeles' });
    } catch (_) {
      utcFormatted = now.toISOString();
      pacificFormatted = now.toLocaleString('zh-CN');
    }
    res.json({
      timestamp,
      utc,
      utcFormatted,
      pacific: pacificFormatted,
      pacificFormatted,
    });
  } catch (err) {
    res.status(500).json({ error: '获取时间失败' });
  }
});

// 获取当前节日（含 Buff，无需鉴权）
router.get('/festival', async (req, res) => {
  try {
    const now = new Date();
    const festival = await Festival.findOne({
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean();

    if (!festival) {
      return res.json({
        name: '',
        buffs: {
          shineRateBoost: 1,
          goldBoost: 1,
          expBoost: 1,
          captureRateBoost: 1,
        },
      });
    }

    res.json({
      name: festival.name,
      buffs: {
        shineRateBoost: festival.shineRateBoost ?? 1,
        goldBoost: festival.goldBoost ?? 1,
        expBoost: festival.expBoost ?? 1,
        captureRateBoost: festival.captureRateBoost ?? 1,
      },
    });
  } catch (err) {
    console.error('Festival get error:', err.message);
    res.status(500).json({ error: '获取节日失败' });
  }
});

// 未匹配的 /api/* 请求传递给后续路由（如 auth）
router.use((req, res, next) => next());

module.exports = router;
