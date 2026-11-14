MarioMakeChat (MoMo) - A completely offline, local AI assistant built for Scratch/TurboWarp.
Features: Local Qwen2.5, Vision AI, Agent Tool-calling, and WebSocket real-time Scratch integration.
Check the README for download links!


# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue)](https://github.com/wenbofeng/MarioMakeChat)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blueviolet)](https://github.com/wenbofeng/MarioMakeChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/wenbofeng/MarioMakeChat)](https://github.com/wenbofeng/MarioMakeChat/releases)

> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库、Ollama 热切换与 Scratch 极速联动！现已完美支持 macOS 与 Windows 双平台独立运行发布！

## 🚀 V10.1.0 Pro 3FS 震撼发布
本次更新带来了三个史诗级 Pro 功能：
1. 🧠 **模型热切换**：支持在 1.5B / 3B 本地模型与 Ollama 引擎间无缝动态切换，按需分配内存，告别卡顿！
2. ⚡ **Scratch 极速联动**：底层重构为 WebSocket 双向通信，内置防丢包队列，实现 TurboWarp 毫秒级实时交互！
3. 📦 **免环境独立运行**：利用 GitHub Actions 自动构建，提供 Mac `.dmg` 与 Windows `.exe`，小白用户下载即用。

## 📥 下载与安装 (Download & Install)

请前往 [Releases](https://github.com/wenbofeng/MarioMakeChat/releases) 页面，根据你的操作系统选择对应的安装包：

### 🍎 macOS 用户 (macOS 10.15+)
👉 **下载 `墨墨AI_v10.1.0.dmg`**

1. 下载 `.dmg` 文件后双击打开。
2. 将 **墨墨AI.app** 拖拽到 **Applications (应用程序)** 文件夹中。
3. **⚠️ 首次启动提示“已损坏”？** 由于本项目为个人开源项目，未购买苹果开发者签名。请打开 Mac 终端，运行以下命令解除拦截：
   `sudo xattr -cr /Applications/墨墨AI.app`
4. 再次双击即可完美运行（应用会静默驻留在右上角菜单栏）。

### 🪟 Windows 用户 (Windows 10/11)
👉 **下载 `MarioMakeChat-Windows.zip`**

1. 下载 `.zip` 后，解压到一个**纯英文路径**的文件夹中（例如 `D:\MarioMakeChat`）。
2. 双击运行文件夹内的 `MarioMakeChat.exe`。
3. **⚠️ 首次启动出现“Windows 已保护你的电脑”怎么办？**
   请点击提示框中的 **“更多信息”**，然后点击 **“仍要运行”** 即可。
4. 程序会静默在右下角系统托盘常驻，并自动打开浏览器访问 `127.0.0.1:5001`。

### 🐧 Linux / 源码开发者
推荐直接克隆源码运行（请确保安装 Python 3.10+）。我们为你准备了**一键安装脚本**：
`git clone https://github.com/wenbofeng/MarioMakeChat.git`
`cd MarioMakeChat`
`chmod +x install.sh`
`./install.sh`

## ✨ 核心特性 (Features)
- 🧠 **完全离线**：基于 llama-cpp-python 与 Ollama，断网状态下依然能陪你聊天。
- 🔄 **多模型热切换**：极速切换 1.5B/3B 模型或切换至 Ollama 思考模型，低配电脑也能完美运行。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，通过 WebSocket 让你的游戏角色拥有极低延迟的 AI 大脑。
- 🎨 **极客定制**：支持情绪感知、自定义人设、代码高亮、多用户隔离、划词助手与快捷指令。

## 🙏 致谢 (Credits)
本项目之所以能够完全离线运行，得益于以下开源团队的无私奉献：
- **Qwen 团队**：感谢阿里云开源 Qwen2.5 模型。
- **llama.cpp 团队**：感谢 ggml-org 提供底层 C++ 推理引擎。
- **开源社区**：感谢所有在开源社区默默奉献的极客们。

## 📄 开源协议 (License)
本项目采用 [MIT License](LICENSE) 协议开源。你可以自由地使用、修改和分发。

---
*Made with ❤️ by FMC SMO (A 3rd-grade developer)*ß
