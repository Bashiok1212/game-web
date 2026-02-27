#!/bin/bash
# 本地代码同步到阿里云服务器
# 使用前请修改下面的配置

# ========== 配置（请修改为你的服务器信息）==========
REMOTE_USER="root"           # 服务器用户名
REMOTE_HOST="47.86.18.91"    # 例如: 47.96.xxx.xxx
REMOTE_PATH="/root/web"      # 服务器上的目标路径
# ================================================

echo "正在同步 /root/web 到 ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
echo ""

rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '.env' \
  /root/web/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ 同步完成"
else
  echo ""
  echo "✗ 同步失败，请检查 SSH 连接和配置"
  exit 1
fi
