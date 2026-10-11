cd /Users/pp/Desktop/MarioMakeChat
lsof -ti:5001 | xargs kill -9 2>/dev/null
sleep 1
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export TOKENIZERS_PARALLELISM=false
export HF_ENDPOINT=https://hf-mirror.com
/opt/miniconda3/envs/qwen_env/bin/python server.py