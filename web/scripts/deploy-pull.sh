#!/bin/bash
# 服务器端：以远程为准同步代码，安装依赖并重启
# 用法：在仓库根目录执行 bash web/scripts/deploy-pull.sh
set -e
# 脚本在 web/scripts/，上一级是 web/（含 package.json）
WEB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WEB_DIR"
# 若在仓库根（有 API.md + web/），需进入 web/
if [ ! -f "package.json" ] && [ -f "web/package.json" ]; then
  cd web
fi
git fetch origin
git reset --hard origin/main
npm install --production
pm2 restart game-web 2>/dev/null || (pm2 start server.js --name game-web 2>/dev/null || echo "请手动启动: pm2 start server.js --name game-web")
echo "部署完成"
