#!/bin/bash
# 云服务器部署：拉取代码、安装依赖、重启服务
# 用法：cd /root/web && bash deploy-pull.sh
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "========== 部署 =========="
[ -f "package.json" ] || { echo "错误: 未找到 package.json"; exit 1; }

git fetch origin
git reset --hard origin/main

# 确保 .env 存在且 JWT_SECRET 已配置（git 不跟踪 .env）
node scripts/ensure-env.js 2>/dev/null || true
npm install --production
# 堆叠上限迁移：删除 playeritems 唯一索引（允许多格同物品）
node scripts/migrate-stack-limit.js 2>/dev/null || true
pm2 restart game-web 2>/dev/null || pm2 start server.js --name game-web
echo "部署完成 ✓"
