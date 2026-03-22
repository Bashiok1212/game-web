const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

/**
 * PTCG 管理员 JWT（载荷需含 adminId）
 */
function ptcgAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ptcg_admin' || decoded.sub !== 'ptcg' || !decoded.adminId) {
      return res.status(403).json({ error: '无效令牌，请重新登录' });
    }
    req.ptcgAdminId = decoded.adminId;
    next();
  } catch (e) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

module.exports = { ptcgAuthMiddleware };
