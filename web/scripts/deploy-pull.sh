#!/bin/bash
# 服务器端：以远程为准同步代码，安装依赖并重启
# 在服务器上执行: bash scripts/deploy-pull.sh
cd "$(dirname "$0")/.."
git fetch origin
git reset --hard origin/main
npm install --production
pm2 restart game-web 2>/dev/null || (pm2 start ecosystem.config.cjs && echo "已启动")
echo "部署完成"
