#!/bin/bash
# 云服务器部署：拉取代码、安装依赖、重启服务
# 用法：cd /root/web && bash deploy-pull.sh
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "========== 部署 =========="
[ -f "package.json" ] || { echo "错误: 未找到 package.json"; exit 1; }
git fetch origin
git reset --hard origin/main
npm install --production
pm2 restart game-web 2>/dev/null || pm2 start server.js --name game-web
echo "部署完成 ✓"
