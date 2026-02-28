// 首次启动时确保 .env 和 JWT_SECRET 存在
try { require('./scripts/ensure-env.js'); } catch (e) { console.error('ensure-env:', e.message); }
require('dotenv').config();

process.on('uncaughtException', (err) => { console.error('uncaughtException:', err); });
process.on('unhandledRejection', (err) => { console.error('unhandledRejection:', err); });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const miscRoutes = require('./routes/misc');
const { authMiddleware } = require('./middleware/auth');
const Character = require('./models/Character');
const PlayerItem = require('./models/PlayerItem');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// 反向代理信任（阿里云 SLB 等）
app.set('trust proxy', 1);

// 安全头（生产环境启用完整 CSP）
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// 请求体大小限制
app.use(express.json({ limit: '10kb' }));

// CORS：生产环境必须配置具体域名
const corsOrigin = process.env.CORS_ORIGIN || '*';
if (isProd && corsOrigin === '*') {
  console.warn('生产环境建议设置 CORS_ORIGIN 为具体域名');
}
const corsOpts = {
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim()),
  credentials: corsOrigin !== '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOpts));

// 全局限流
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 200,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// 登录/注册严格限流（防暴力破解）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: '尝试次数过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/user/password', authLimiter);

app.use('/api/admin', adminRoutes);
async function discardPlayerItemHandler(req, res) {
  const quantity = parseInt(req.query?.quantity ?? req.body?.quantity ?? 0, 10);
  console.log('[Discard]', req.method, req.path, 'id=', req.params.id, 'quantity=', quantity);
  try {
    const playerItemId = req.params.id;
    const playerItem = await PlayerItem.findById(playerItemId);
    if (!playerItem) return res.status(404).json({ error: '物品不存在' });
    const character = await Character.findById(playerItem.character);
    if (!character || character.user.toString() !== req.user.id) {
      return res.status(403).json({ error: '无权丢弃该物品' });
    }
    const total = Math.max(1, playerItem.quantity ?? 1);
    const toDiscard = quantity > 0 ? Math.min(quantity, total) : total;
    if (toDiscard >= total) {
      await PlayerItem.findByIdAndDelete(playerItemId);
    } else {
      playerItem.quantity = total - toDiscard;
      await playerItem.save();
    }
    res.json({ message: '已丢弃', discarded: toDiscard });
  } catch (err) {
    console.error('Discard player-item error:', err.message);
    res.status(500).json({ error: '丢弃失败' });
  }
}
app.delete('/api/user/player-items/:id', authMiddleware, discardPlayerItemHandler);
app.post('/api/user/player-items/:id/discard', authMiddleware, discardPlayerItemHandler);
const apiRouter = express.Router();
apiRouter.use(miscRoutes);
apiRouter.use(authRoutes);
app.use('/api', apiRouter);

// 管理后台（放在 static 之前）- 服务端注入服务器时间，确保直接可见
function serveAdminPage(req, res) {
  const htmlPath = path.resolve(__dirname, 'public', 'admin.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const now = new Date();
  let serverTimeStr;
  try {
    serverTimeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch (_) {
    serverTimeStr = now.toLocaleString('zh-CN');
  }
  html = html.replace(/服务器时间: 加载中\.\.\./g, `服务器时间: ${serverTimeStr}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.type('html').send(html);
}
app.get('/admin', serveAdminPage);
app.get('/admin/', (req, res) => {
  res.redirect(301, '/admin');
});
app.get('/admin.html', (req, res) => {
  res.redirect(301, '/admin');
});

// 诊断：确认服务端动态内容是否生效（访问 /admin-check 查看）
app.get('/admin-check', (req, res) => {
  const t = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<h1>服务端正常</h1><p>服务器时间: ${t}</p><p><a href="/admin">进入管理后台</a></p>`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 统一错误处理，避免泄露堆栈
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}${isProd ? ' (生产)' : ''}`);
});
