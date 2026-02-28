#!/bin/bash
# 部署验证：检查 discard 等接口是否已部署
# 用法：cd /root/web && bash scripts/verify-deploy.sh
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "========== 部署验证 =========="
echo "项目目录: $(pwd)"

# 1. 检查 server.js 是否包含 discard 路由
if grep -q "player-items/:id" server.js 2>/dev/null; then
  echo "✓ server.js 包含 player-items 丢弃路由"
else
  echo "✗ server.js 缺少 discard 路由，请先 git pull"
fi

# 2. 检查 auth.js 是否包含 delete 路由
if grep -q "player-items/:id" routes/auth.js 2>/dev/null; then
  echo "✓ routes/auth.js 包含 player-items 丢弃路由"
else
  echo "✗ routes/auth.js 缺少 discard 路由"
fi

# 3. 检查 misc.js 是否有 health
if grep -q "health" routes/misc.js 2>/dev/null; then
  echo "✓ routes/misc.js 包含 /health 接口"
else
  echo "✗ routes/misc.js 缺少 /health 接口"
fi

# 4. 本地测试（若服务在运行）
echo ""
echo "本地 API 测试 (localhost:3000):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/time 2>/dev/null | grep -q 200; then
  echo "  GET /api/time: 200 ✓"
else
  echo "  GET /api/time: 失败（服务可能未启动）"
fi

HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "  GET /api/health: JSON ✓"
else
  echo "  GET /api/health: 无 JSON 或未部署"
fi

echo ""
echo "若上述有 ✗，请在服务器执行: cd /root/web && bash deploy-pull.sh"
