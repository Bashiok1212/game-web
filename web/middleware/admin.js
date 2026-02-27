const User = require('../models/User');

function adminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录' });
  User.findById(req.user.id)
    .then((user) => {
      if (!user || !['admin', 'ow'].includes(user.role)) {
        return res.status(403).json({ error: '需要管理员权限' });
      }
      req.admin = user;
      next();
    })
    .catch(() => res.status(500).json({ error: '权限验证失败' }));
}

module.exports = { adminMiddleware };
