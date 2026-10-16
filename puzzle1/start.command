#!/bin/bash
# 推箱子 · 本地启动脚本（macOS 双击即可运行）
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8000}"
while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT/"

echo ""
echo "  推箱子 · Sokoban"
echo "  ------------------------------------"
echo "  服务器已启动：$URL"
echo "  按 Control + C 停止"
echo ""

( sleep 1; open "$URL" >/dev/null 2>&1 ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
