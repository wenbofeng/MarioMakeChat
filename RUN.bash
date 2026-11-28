#!/bin/bash
# ==========================================
# MarioMakeChat V10.3.0 智能启动脚本
# ==========================================

# 终端颜色配置
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   🎂 MarioMakeChat V10.3.0 Birthday Ed.  ${NC}"
echo -e "${BLUE}==========================================${NC}"

# 1. 检查 Node.js 并进行全栈语法体检
if command -v node &> /dev/null
then
    if [ -f "omni-check.js" ]; then
        echo -e "\n🔍 正在执行全栈代码体检..."
        node omni-check.js
        if [ $? -ne 0 ]; then
            echo -e "${RED}🚨 语法检查未通过，请先修复代码！${NC}"
            exit 1
        fi
    fi
fi

# 2. 清理可能被占用的 5001 端口（防止 Address already in use）
echo -e "\n🧹 正在清理 5001 端口..."
PORT_PID=$(lsof -t -i:5001)
if [ -n "$PORT_PID" ]; then
    echo -e "发现占用进程 (PID: $PORT_PID)，正在清理..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# 3. 启动 Python 后端
echo -e "\n🚀 正在启动墨墨 AI..."
# 如果使用 conda 环境，可以取消下面这行的注释并修改环境名
# conda activate qwen_env

python server.py &
SERVER_PID=$!

# 4. 等待服务器启动，然后打开浏览器
echo -e "\n⏳ 等待服务器就绪..."
sleep 3
echo -e "${GREEN}✅ 启动成功！正在打开浏览器...${NC}"
open "http://127.0.0.1:5001"  # Windows 环境下请改成 start http://127.0.0.1:5001

# 5. 优雅退出：当用户按 Ctrl+C 时，同时关闭后台的 Python 进程
trap "echo -e '\n🛑 正在关闭墨墨...'; kill $SERVER_PID 2>/dev/null; exit" SIGINT SIGTERM

# 保持脚本运行，监听 Python 进程
wait $SERVER_PID