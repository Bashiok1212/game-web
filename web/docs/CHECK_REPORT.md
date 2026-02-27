# 项目检查报告

**检查时间**: 2026-02-25

## ✅ 正常项

| 模块 | 状态 | 说明 |
|------|------|------|
| 服务启动 | ✅ | 运行正常，MongoDB 已连接 |
| 认证中间件 | ✅ | JWT 使用 SECRET 正确校验 |
| 路由顺序 | ✅ | 静态文件 → API → 兜底，顺序正确 |
| 安全头 | ✅ | Helmet、CSP、HSTS、限流已配置 |
| 输入校验 | ✅ | 用户名、邮箱、密码均有校验 |
| 弱密码拦截 | ✅ | 常见弱密码已拦截 |
| 前端 XSS | ✅ | 使用 textContent，无 innerHTML |
| .gitignore | ✅ | node_modules、.env、data 已忽略 |

## ⚠️ 建议改进

### 1. 登录接口缺少用户名格式校验
- **位置**: `routes/auth.js` 第 53 行
- **说明**: `loginBy` 直接用于查询，若传入异常对象可能影响查询
- **建议**: 对 `loginBy` 做类型和长度校验（已用 trim/slice，可补充 `typeof` 检查）

### 2. 错误处理中间件可能无法捕获异步错误
- **位置**: `server.js` 第 82-86 行
- **说明**: Express 4 不会自动捕获 async 中的未处理错误
- **建议**: 各路由已有 try/catch，当前可接受；后续可考虑升级 Express 5 或使用 express-async-errors

### 3. 生产环境配置提醒
- 部署前需设置 `NODE_ENV=production`
- 需设置 `JWT_SECRET`（至少 32 位随机字符串）
- 建议将 `CORS_ORIGIN` 设为具体域名

## 📁 项目结构

```
web/
├── config/db.js       # MongoDB 连接
├── middleware/auth.js # JWT 认证
├── models/User.js     # 用户模型
├── routes/auth.js     # 认证 API
├── utils/validation.js# 输入校验
├── public/            # 前端静态资源
├── scripts/           # 运维脚本
└── server.js          # 入口
```

## 🔒 安全措施汇总

- Helmet 安全头
- 登录/注册限流（15 次/15 分钟）
- 全局限流（100–200 次/15 分钟）
- 弱密码拦截
- 输入校验与 XSS 防护
- JWT 生产环境 24h 过期
- 错误响应不泄露内部信息
