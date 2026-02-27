const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !JWT_SECRET) {
  console.error('生产环境必须设置 JWT_SECRET 环境变量');
  process.exit(1);
}

const SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET: SECRET };
