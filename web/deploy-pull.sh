#!/bin/bash
# 云服务器部署脚本：拉取最新代码并重启服务
# 用法：在 /root/web 目录下执行 ./deploy-pull.sh

set -e

# 项目目录（脚本所在目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========== 开始部署 =========="
echo "目录: $SCRIPT_DIR"
echo ""

# 1. 拉取最新代码
echo "[1/4] 拉取最新代码..."
git pull origin main || git pull origin master
echo ""

# 2. 安装依赖
echo "[2/4] 安装依赖..."
npm install --production
echo ""

# 3. 重启服务
echo "[3/4] 重启服务..."
if command -v pm2 &>/dev/null; then
  pm2 restart game-web 2>/dev/null || pm2 restart all
  echo "已通过 pm2 重启"
elif [ -f /etc/systemd/system/game-web.service ]; then
  sudo systemctl restart game-web
  echo "已通过 systemd 重启"
else
  echo "⚠ 未检测到 pm2 或 systemd，请手动重启："
  echo "  pm2 restart game-web   # 若使用 pm2"
  echo "  或 kill 旧进程后重新运行: npm start"
fi
echo ""

# 4. 完成
echo "[4/4] 部署完成 ✓"
echo ""
