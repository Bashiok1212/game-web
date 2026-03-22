/**
 * 若 .env 配置了 PTCG_ADMIN_USER / PTCG_ADMIN_PASSWORD，且 Mongo 中尚无该用户名，则创建一条 PtcgAdmin（便于与纯 Mongo 登录统一）
 */
const bcrypt = require('bcryptjs');
const PtcgAdmin = require('../models/PtcgAdmin');

async function syncPtcgEnvUser() {
  const u = (process.env.PTCG_ADMIN_USER || '').trim().toLowerCase();
  const p = process.env.PTCG_ADMIN_PASSWORD;
  if (!u || !p) return;
  const exists = await PtcgAdmin.findOne({ username: u });
  if (!exists) {
    await PtcgAdmin.create({
      username: u,
      password_hash: bcrypt.hashSync(p, 12),
    });
    console.log('PTCG: 已从 .env 同步管理员到 MongoDB:', u);
  }
}

module.exports = { syncPtcgEnvUser };
