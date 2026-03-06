// 首次启动时确保 .env 和 JWT_SECRET 存在
try { require('./scripts/ensure-env.js'); } catch (e) { console.error('ensure-env:', e.message); }
require('dotenv').config();

process.on('uncaughtException', (err) => { console.error('uncaughtException:', err); });
process.on('unhandledRejection', (err) => { console.error('unhandledRejection:', err); });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

require('./config/db');
const wsHub = require('./wsHub');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const mailRoutes = require('./routes/mail');
const adminRoutes = require('./routes/admin');
const miscRoutes = require('./routes/misc');
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');
const Character = require('./models/Character');
const PlayerItem = require('./models/PlayerItem');
const ChatMessage = require('./models/ChatMessage');

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
apiRouter.use(chatRoutes);
apiRouter.use(mailRoutes);
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

// --- WebSocket: 原生 ws，用于即时聊天推送 ---
function verifyWsToken(token) {
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token') || '';
  const decoded = verifyWsToken(token);
  if (!decoded) {
    ws.close(1008, 'unauthorized');
    return;
  }
  ws.user = decoded;
  ws.subscribedCharacters = new Set();
  wsHub.addClient(ws);
  wsHub.sendJson(ws, { type: 'hello', user: { id: decoded.id, username: decoded.username } });

  // 可选：URL 里直接带 characterId，则自动订阅该角色邮件推送
  const initialCharacterId = url.searchParams.get('characterId') || '';
  if (initialCharacterId) {
    try {
      Character.findOne({ _id: initialCharacterId, user: decoded.id }, { _id: 1 })
        .lean()
        .then((ch) => {
          if (ch && ws.subscribedCharacters) {
            ws.subscribedCharacters.add(String(initialCharacterId));
            wsHub.sendJson(ws, { type: 'mail_subscribed', characterId: String(initialCharacterId) });
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

  ws.on('message', async (buf) => {
    let payload;
    try {
      payload = JSON.parse(buf.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    const type = payload.type || '';

    if (type === 'ping') {
      wsHub.sendJson(ws, { type: 'pong', t: Date.now() });
      return;
    }

    if (type === 'mail_subscribe') {
      const characterId = typeof payload.characterId === 'string' ? payload.characterId.trim() : '';
      if (!characterId) return;
      const ch = await Character.findOne({ _id: characterId, user: ws.user.id }, { _id: 1 }).lean();
      if (!ch) {
        wsHub.sendJson(ws, { type: 'error', error: 'mail_subscribe_denied' });
        return;
      }
      if (ws.subscribedCharacters) ws.subscribedCharacters.add(String(characterId));
      wsHub.sendJson(ws, { type: 'mail_subscribed', characterId: String(characterId) });
      return;
    }

    if (type === 'chat_send') {
      let channel = Number(payload.channel);
      if (!Number.isFinite(channel) || channel < 0 || channel > 4) channel = 0;
      let content = typeof payload.content === 'string' ? payload.content.trim() : '';
      if (!content) return;
      if (content.length > 200) content = content.slice(0, 200);

      const clientMsgId = typeof payload.clientMsgId === 'string' ? payload.clientMsgId.slice(0, 64) : '';
      const senderName = ws.user?.username ? String(ws.user.username).slice(0, 32) : '玩家';

      // 落库（HTTP /chat/send 也会落库；ws 用于即时性）
      let msg;
      try {
        msg = await ChatMessage.create({
          user: ws.user.id,
          channel,
          senderName,
          content,
        });
      } catch (err) {
        wsHub.sendJson(ws, { type: 'error', error: 'chat_save_failed' });
        return;
      }

      wsHub.broadcastJson({
        type: 'chat_message',
        message: {
          id: msg._id.toString(),
          channel: msg.channel,
          sender: msg.senderName,
          content: msg.content,
          created_at: msg.created_at.toISOString(),
          clientMsgId,
        }
      });
    }
  });

  ws.on('close', () => {
    wsHub.removeClient(ws);
  });
  ws.on('error', () => {
    wsHub.removeClient(ws);
  });
});

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}${isProd ? ' (生产)' : ''}`);
  console.log(`WebSocket 运行在 ws://localhost:${PORT}/ws`);
});
