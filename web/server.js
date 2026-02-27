require('dotenv').config();
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
app.use('/api', miscRoutes);
app.use('/api', authRoutes);

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
  html = html.replace('>服务器时间: 加载中...<', `>服务器时间: ${serverTimeStr}<`);
  html = html.replace('id="serverTimeBanner">服务器时间: 加载中...</div>', `id="serverTimeBanner">服务器时间: ${serverTimeStr}</div>`);
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
