@echo off
chcp 65001 >nul
echo =========================================
echo   MarioMakeChat V10.1.0 Pro 4FS 安装向导
echo =========================================

:: 1. 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+ 并勾选 "Add to PATH"！
    pause
    exit /b
)

:: 2. 创建虚拟环境
echo [1/4] 正在创建 Python 虚拟环境...
python -m venv venv
call venv\Scripts\activate.bat

:: 3. 安装依赖
echo [2/4] 正在安装依赖（国内已替换清华源）...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

:: 4. 下载模型
echo [3/4] 准备下载 Qwen 模型...
python download_model.py

echo [4/4] 安装完成！即将启动墨墨...
pause
call start.bat