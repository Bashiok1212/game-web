const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const isProd = process.env.NODE_ENV === 'production';
const PLACEHOLDER = 'your-secret-at-least-32-chars';

if (isProd && (!JWT_SECRET || JWT_SECRET === PLACEHOLDER)) {
  console.error('生产环境必须设置 JWT_SECRET！请执行: cp .env.example .env 并修改 JWT_SECRET');
  console.error('或运行: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" 生成密钥');
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
