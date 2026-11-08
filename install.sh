#!/bin/bash

echo "========================================="
echo "  MarioMakeChat V10.1.0 Pro 4FS 安装向导"
echo "========================================="

# 1. 检查 Python 环境 (Mac 默认通常是 python3)
if ! command -v python3 &> /dev/null
then
    echo "[错误] 未检测到 python3，请先安装 Python 3.10+！"
    echo "可以在终端运行: brew install python"
    exit
fi

# 2. 创建虚拟环境
echo "[1/4] 正在创建 Python 虚拟环境..."
python3 -m venv venv

# 3. 激活虚拟环境并安装依赖
echo "[2/4] 正在激活环境并安装依赖 (使用清华源加速)..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 4. 下载模型
echo "[3/4] 准备下载 Qwen 模型..."
python download_model.py

echo "========================================="
echo "[4/4] 安装完成！"
echo "以后每次启动项目，只需在终端运行以下两行命令："
echo "source venv/bin/activate"
echo "python app.py (或你的启动脚本)"
echo "========================================="