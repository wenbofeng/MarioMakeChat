# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue)](https://github.com/wenbofeng/MarioMakeChat)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blueviolet)](https://github.com/wenbofeng/MarioMakeChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/wenbofeng/MarioMakeChat)](https://github.com/wenbofeng/MarioMakeChat/releases)

> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库与 Scratch 联动！现已完美支持 macOS 与 Windows 双平台！

## 📥 下载与安装 (Download & Install)

请前往 [Releases](https://github.com/wenbofeng/MarioMakeChat/releases) 页面，根据你的操作系统选择对应的安装包：

### 🍎 macOS 用户 (macOS 10.15+)
👉 **[点击这里下载 MarioMakeChat_v9.0.1.dmg (约 451 MB)](https://github.com/wenbofeng/MarioMakeChat/releases)**

1. 下载 `.dmg` 文件后双击打开。
2. 将 **MarioMakeChat.app** 拖拽到 **Applications (应用程序)** 文件夹中。
3. **⚠️ 首次启动提示“已损坏”？** 由于本项目为个人开源项目，未购买苹果开发者签名。请打开 Mac 终端，运行以下命令解除拦截：
   ```bash
   sudo xattr -cr /Applications/MarioMakeChat.app
   ```
4. 再次双击即可完美运行（应用会静默驻留在右上角菜单栏，出现“墨”字图标）。

### 🪟 Windows 用户 (Windows 10/11)
👉 **请在 Releases 页面下载 `MarioMakeChat-Windows.zip` 压缩包**

1. 下载 `.zip` 后，解压到一个**纯英文路径**的文件夹中（例如 `D:\MarioMakeChat`）。
2. 双击运行文件夹内的 `MarioMakeChat.exe`。
3. **⚠️ 首次启动出现“Windows 已保护你的电脑”怎么办？**
   因为未购买微软的代码签名证书，请点击提示框中的 **“更多信息”**，然后点击 **“仍要运行”** 即可。
4. 程序会在后台静默启动，并自动打开浏览器访问 `127.0.0.1:5001`。

## ✨ 核心特性 (Features)
- 🧠 **完全离线**：基于 llama-cpp-python，断网状态下依然能陪你聊天。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，让你的游戏角色拥有 AI 大脑。
- 🎨 **极客定制**：支持情绪感知、自定义人设、代码高亮、多用户隔离与快捷指令。
- ☁️ **云端自动打包**：利用 GitHub Actions 实现 Windows/Mac 跨平台自动构建。

## 🛠️ 开发与源码运行 (For Developers)
如果你想在本地源码环境下运行或二次开发，请确保安装了 Python 3.10：

```bash
git clone https://github.com/wenbofeng/MarioMakeChat.git
cd MarioMakeChat
conda create -n qwen_env python=3.10
conda activate qwen_env
pip install -r requirements.txt
python server.py
```

## 🐧 Linux 用户提示 (For Linux Users)

由于 Linux 发行版众多，且通常自带完善的 Python 开发环境，本项目暂不提供打包好的二进制安装包。**Linux 极客用户请直接克隆源码运行**：

```bash
# 1. 克隆项目
git clone https://github.com/wenbofeng/MarioMakeChat.git
cd MarioMakeChat

# 2. 创建并激活虚拟环境
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖 (注意：Linux 环境不需要 macOS 专属的 rumps 库)
pip install flask llama-cpp-python ddgs opencc-python-reimplemented pypdf python-docx python-pptx pillow pytesseract sentence-transformers==2.7.0 transformers==4.36.2 modelscope psutil

# 4. 启动墨墨
python server.py
```

> **💡 提示**：启动后，请在浏览器中访问 `http://127.0.0.1:5001` 即可开始对话。如果你需要图形化桌面图标，可以自行编写 `systemd` 服务或 `.desktop` 文件。

## 📄 开源协议 (License)
本项目采用 [MIT License](LICENSE) 协议开源。你可以自由地使用、修改和分发。

---
*Made with ❤️ by FMC SMO (A 3rd-grade developer)*