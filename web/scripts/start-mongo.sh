#!/bin/bash
# MongoDB 启动脚本 - 阿里云 / Ubuntu / Debian

set -e

# 检查是否已安装
if command -v mongod &>/dev/null; then
  echo "启动 MongoDB..."
  sudo systemctl start mongod 2>/dev/null || sudo service mongod start 2>/dev/null || mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb_data 2>/dev/null
  echo "MongoDB 已启动"
  exit 0
fi

# 检查 Docker
if command -v docker &>/dev/null; then
  echo "使用 Docker 启动 MongoDB..."
  docker run -d -p 27017:27017 --name mongo --restart unless-stopped mongo:7 2>/dev/null || docker start mongo 2>/dev/null
  echo "MongoDB (Docker) 已启动"
  exit 0
fi

# 安装 MongoDB (Ubuntu 22.04 / Debian)
echo "正在安装 MongoDB..."
if [ -f /etc/debian_version ]; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  sudo apt-get update -qq && sudo apt-get install -y mongodb-org
  sudo systemctl start mongod
  sudo systemctl enable mongod
  echo "MongoDB 已安装并启动"
else
  echo "请手动安装 MongoDB: https://www.mongodb.com/docs/manual/installation/"
  echo "或使用 MongoDB Atlas (免费): https://www.mongodb.com/atlas"
  exit 1
fi
