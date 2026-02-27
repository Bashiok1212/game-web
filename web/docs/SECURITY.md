# 安全配置说明

## 生产环境部署前必做

### 1. 环境变量
```bash
NODE_ENV=production
JWT_SECRET=<32位以上随机字符串>
CORS_ORIGIN=https://你的域名.com
```

### 2. JWT 密钥生成
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 阿里云安全组
- 仅开放必要端口（如 80、443、3000）
- 建议使用 Nginx 反向代理，不直接暴露 Node 端口

### 4. HTTPS
- 生产环境必须使用 HTTPS
- 可配合 Let's Encrypt 免费证书

## 已启用的安全措施

- Helmet 安全头（CSP、HSTS、XSS 过滤等）
- 登录/注册限流（15 分钟 15 次）
- 全局限流（15 分钟 100 次）
- 弱密码拦截
- 输入校验与 XSS 防护
- JWT 生产环境 24 小时过期
- 错误响应不泄露内部信息
