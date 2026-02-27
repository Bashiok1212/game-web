#!/bin/bash
# 云服务器部署：拉取代码、安装依赖、重启服务
# 用法：在仓库根目录执行 bash deploy-pull.sh
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"
echo "========== 部署 =========="
echo "目录: $REPO_ROOT"
git fetch origin
git reset --hard origin/main
# 进入 web 目录（package.json 所在处）
if [ -f "web/package.json" ]; then
  cd web
elif [ ! -f "package.json" ]; then
  echo "错误: 未找到 package.json"
  exit 1
fi
npm install --production
pm2 restart game-web 2>/dev/null || pm2 start server.js --name game-web
echo "部署完成 ✓"
