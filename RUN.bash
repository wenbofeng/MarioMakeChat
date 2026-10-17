#!/bin/bash
cd "$(dirname "$0")"

# 参数解析
DAEMON=0
LOG_FILE="/tmp/mmai.log"
for arg in "$@"; do
  case "$arg" in
    -d|--daemon) DAEMON=1 ;;
    -h|--help)
      echo "用法："
      echo "  ./RUN.bash          前台运行（Ctrl+C 停止）"
      echo "  ./RUN.bash -d       后台运行，日志写到 $LOG_FILE"
      echo "  ./RUN.bash -d -f    后台运行并 tail 日志"
      exit 0
      ;;
    -f|--follow) FOLLOW=1 ;;
  esac
done

# 清理占用 5001 的进程
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 1

# 离线环境
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export TOKENIZERS_PARALLELISM=false
export HF_ENDPOINT=https://hf-mirror.com

# 找 Python：优先 qwen_env，其次当前 conda 环境，最后系统 python3
QWEN_PY="$HOME/opt/miniconda3/envs/qwen_env/bin/python"
# 或者用 conda 的路径
QWEN_PY="$(conda info --base 2>/dev/null)/envs/qwen_env/bin/python"

if [ -x "$QWEN_PY" ]; then
  PYTHON="$QWEN_PY"
elif [ -n "$CONDA_PREFIX" ] && [ -x "$CONDA_PREFIX/bin/python" ]; then
  PYTHON="$CONDA_PREFIX/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "❌ 找不到 Python"
  exit 1
fi

# 前台 or 后台
if [ "$DAEMON" = "1" ]; then
  nohup "$PYTHON" server.py > "$LOG_FILE" 2>&1 &
  echo "✅ 墨墨已在后台启动，PID: $!，日志：$LOG_FILE"
  echo "   停止：lsof -ti:5001 | xargs kill -9"
  if [ "$FOLLOW" = "1" ]; then
    echo "--- 跟踪日志（Ctrl+C 退出）---"
    tail -f "$LOG_FILE"
  fi
else
  exec "$PYTHON" server.py
fi