/**
 * PTCG 个人卡牌页：MongoDB 管理员账号 + 可选 .env 兼容登录
 * 环境变量：
 * - PTCG_ADMIN_USER / PTCG_ADMIN_PASSWORD：无 Mongo 账号时的备用登录（可选）
 * - PTCG_REGISTER_SECRET：若设置，任何注册请求都必须带相同 registerSecret；未设置时仅允许首个账号注册
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { JWT_SECRET } = require('../middleware/auth');
const PtcgAdmin = require('../models/PtcgAdmin');

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function issueToken(res) {
  const token = jwt.sign(
    { sub: 'ptcg', role: 'ptcg_admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ ok: true, token });
}

/** POST /api/ptcg/register */
router.post('/register', async (req, res) => {
  try {
    const { username, password, registerSecret } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const u = String(username).trim().toLowerCase();
    if (u.length < 3 || u.length > 32) {
      return res.status(400).json({ error: '用户名长度为 3～32 位' });
    }

    const envSecret = (process.env.PTCG_REGISTER_SECRET || '').trim();
    const count = await PtcgAdmin.countDocuments();

    if (envSecret) {
      if (!registerSecret || !safeCompare(String(registerSecret).trim(), envSecret)) {
        return res.status(403).json({ error: '注册密钥错误' });
      }
    } else if (count > 0) {
      return res.status(403).json({
        error:
          '已有账号或需注册密钥：请在服务器 .env 设置 PTCG_REGISTER_SECRET 后，凭密钥注册',
      });
    }

    const exists = await PtcgAdmin.findOne({ username: u });
    if (exists) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    await PtcgAdmin.create({
      username: u,
      password_hash: bcrypt.hashSync(password, 12),
    });
    res.json({ ok: true, message: '注册成功，请登录' });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error('ptcg register error', e);
    res.status(500).json({ error: '注册失败' });
  }
});

/** POST /api/ptcg/login */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }
    const u = String(username).trim().toLowerCase();
    const doc = await PtcgAdmin.findOne({ username: u }).select('+password_hash');
    if (doc) {
      if (!bcrypt.compareSync(password, doc.password_hash)) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      return issueToken(res);
    }

    const envUser = (process.env.PTCG_ADMIN_USER || '').trim().toLowerCase();
    const envPass = process.env.PTCG_ADMIN_PASSWORD || '';
    if (envUser && envPass && safeCompare(u, envUser) && safeCompare(String(password), envPass)) {
      return issueToken(res);
    }

    const hasAny = await PtcgAdmin.countDocuments();
    if (!hasAny && !envUser) {
      return res.status(503).json({
        error:
          '尚未配置管理员：请先注册账号，或在 .env 设置 PTCG_ADMIN_USER / PTCG_ADMIN_PASSWORD',
      });
    }
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (e) {
    console.error('ptcg login error', e);
    res.status(500).json({ error: '登录失败' });
  }
});

/** GET /api/ptcg/verify */
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ptcg_admin' || decoded.sub !== 'ptcg') {
      return res.status(403).json({ error: '无效令牌' });
    }
    res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
});

module.exports = router;
