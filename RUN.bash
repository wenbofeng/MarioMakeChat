#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 1
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export TOKENIZERS_PARALLELISM=false
export HF_ENDPOINT=https://hf-mirror.com
if [ -n "$CONDA_PREFIX" ] && [ -x "$CONDA_PREFIX/bin/python" ]; then
  PYTHON="$CONDA_PREFIX/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "❌ 找不到 Python，请先 conda activate qwen_env 或安装 python3"
  exit 1
fi
echo "🚀 使用 Python: $PYTHON"
exec "$PYTHON" server.py