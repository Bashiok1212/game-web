const WebSocket = require('ws');

// 全局 WS 客户端集合（server.js 初始化时注入/维护）
const clients = new Set();

function addClient(ws) {
  clients.add(ws);
}

function removeClient(ws) {
  clients.delete(ws);
}

function sendJson(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (_) {}
}

function broadcastJson(obj) {
  const data = JSON.stringify(obj);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(data); } catch (_) {}
    }
  }
}

function notifyMailNew(characterId, mailId) {
  if (!characterId) return;
  const data = JSON.stringify({ type: 'mail_new', characterId: String(characterId), mailId: mailId ? String(mailId) : '' });
  for (const client of clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const subs = client.subscribedCharacters;
    if (subs && typeof subs.has === 'function' && subs.has(String(characterId))) {
      try { client.send(data); } catch (_) {}
    }
  }
}

module.exports = {
  addClient,
  removeClient,
  sendJson,
  broadcastJson,
  notifyMailNew,
};

