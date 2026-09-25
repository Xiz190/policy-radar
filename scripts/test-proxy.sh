#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
    exit 1
  fi
}

echo -e "${YELLOW}=== 代理路由测试脚本 ===${NC}"
echo ""

echo -e "${YELLOW}[1/5] 清理旧进程${NC}"
pkill -f "next dev" 2>/dev/null || true
sleep 1

echo -e "${YELLOW}[2/5] 启动开发服务器${NC}"
ADMIN_TOKEN=test-token-123 npm run dev > /tmp/next-dev.log 2>&1 &
NEXT_PID=$!
echo "服务器 PID: $NEXT_PID"

echo "等待服务器启动..."
for i in {1..10}; do
  if curl -s http://localhost:3000/api/monitor/items?limit=1 > /dev/null 2>&1; then
    echo -e "${GREEN}服务器已启动${NC}"
    break
  fi
  sleep 1
  if [ $i -eq 10 ]; then
    echo -e "${RED}服务器启动超时${NC}"
    kill $NEXT_PID
    exit 1
  fi
done
echo ""

echo -e "${YELLOW}[3/5] 测试 GET 请求${NC}"
echo ""

echo "测试 1: 直连 GET /api/monitor/items"
curl -s "http://localhost:3000/api/monitor/items?limit=3" | jq '.items | length' > /tmp/test-get-direct.txt
DIRECT_GET_COUNT=$(cat /tmp/test-get-direct.txt)
echo "直连返回条目数: $DIRECT_GET_COUNT"
if [ "$DIRECT_GET_COUNT" = "3" ]; then
  print_result 0 "直连 GET 请求成功"
else
  print_result 1 "直连 GET 请求失败"
fi

echo ""
echo "测试 2: 代理 GET /api/proxy/monitor/items"
curl -s "http://localhost:3000/api/proxy/monitor/items?limit=3" | jq '.items | length' > /tmp/test-get-proxy.txt
PROXY_GET_COUNT=$(cat /tmp/test-get-proxy.txt)
echo "代理返回条目数: $PROXY_GET_COUNT"
if [ "$PROXY_GET_COUNT" = "3" ]; then
  print_result 0 "代理 GET 请求成功"
else
  print_result 1 "代理 GET 请求失败"
fi

echo ""
echo "测试 3: 对比直连和代理的响应"
if [ "$DIRECT_GET_COUNT" = "$PROXY_GET_COUNT" ]; then
  print_result 0 "直连和代理返回一致"
else
  print_result 1 "直连和代理返回不一致"
fi

echo ""
echo -e "${YELLOW}[4/5] 测试 POST 请求${NC}"
echo ""

echo "测试 4: 直连 POST /api/monitor/items/batch (标记全部已读)"
DIRECT_POST_STATUS=$(curl -s -o /tmp/test-post-direct.txt -w "%{http_code}" -X POST "http://localhost:3000/api/monitor/items/batch?action=mark-all-read" -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" -d '{}')
echo "直连 POST 状态码: $DIRECT_POST_STATUS"
if [ "$DIRECT_POST_STATUS" = "200" ]; then
  print_result 0 "直连 POST 请求成功"
else
  echo -e "${RED}直连 POST 响应: $(cat /tmp/test-post-direct.txt)${NC}"
  print_result 1 "直连 POST 请求失败"
fi

echo ""
echo "测试 5: 代理 POST /api/proxy/monitor/items/batch (标记全部已读)"
PROXY_POST_STATUS=$(curl -s -o /tmp/test-post-proxy.txt -w "%{http_code}" -X POST "http://localhost:3000/api/proxy/monitor/items/batch?action=mark-all-read" -H "Content-Type: application/json" -d '{}')
echo "代理 POST 状态码: $PROXY_POST_STATUS"
if [ "$PROXY_POST_STATUS" = "200" ]; then
  print_result 0 "代理 POST 请求成功"
else
  echo -e "${RED}代理 POST 响应: $(cat /tmp/test-post-proxy.txt)${NC}"
  print_result 1 "代理 POST 请求失败"
fi

echo ""
echo "测试 6: 对比直连和代理的 POST 响应"
DIRECT_POST_BODY=$(cat /tmp/test-post-direct.txt | jq -r '.ok')
PROXY_POST_BODY=$(cat /tmp/test-post-proxy.txt | jq -r '.ok')
echo "直连响应 ok: $DIRECT_POST_BODY"
echo "代理响应 ok: $PROXY_POST_BODY"
if [ "$DIRECT_POST_BODY" = "$PROXY_POST_BODY" ] && [ "$DIRECT_POST_BODY" = "true" ]; then
  print_result 0 "直连和代理 POST 响应一致"
else
  print_result 1 "直连和代理 POST 响应不一致"
fi

echo ""
echo -e "${YELLOW}[5/5] 清理${NC}"
kill $NEXT_PID
echo "服务器已停止"

echo ""
echo -e "${GREEN}=== 所有测试通过 ===${NC}"
echo ""
echo "代理路由功能验证完成："
echo "  ✓ GET 请求正确转发"
echo "  ✓ POST 请求正确转发"
echo "  ✓ ADMIN_TOKEN 自动注入"
echo "  ✓ 响应与直连一致"