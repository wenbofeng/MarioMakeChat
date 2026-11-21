# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue)](https://github.com/wenbofeng/MarioMakeChat)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blueviolet)](https://github.com/wenbofeng/MarioMakeChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/wenbofeng/MarioMakeChat)](https://github.com/wenbofeng/MarioMakeChat/releases)
[![Star](https://img.shields.io/github/stars/wenbofeng/MarioMakeChat?style=social)](https://github.com/wenbofeng/MarioMakeChat)

> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库、Ollama 热切换、多模态视觉，内置**Scratch 极速联动**与**微积分扩展**！现已完美支持 macOS 与 Windows 双平台独立运行。

## 🚀 V10.3.0 Pro 2FS 震撼发布
本次更新将“墨墨”的易用性与可玩性推向了新高度：
1. 🧠 **全自动模型管家**：小白福音！免去手动配置，直接在网页端一键多线程极速下载 Qwen1.5B/3B 模型，实时显示进度条。
2. 🧮 **Scratch 微积分扩展**：内置 `calculus-extension.js`，在 TurboWarp 中直接通过积木进行求导、积分和泰勒展开！真正的数学降维打击。
3. 🎙️ **语音与多模态**：支持本地语音 TTS 朗读，支持上传图片进行视觉分析（基于 Ollama llava/llama3）。

## 📥 下载与安装 (Download & Install)

请前往 [Releases](https://github.com/wenbofeng/MarioMakeChat/releases) 页面，根据你的操作系统选择对应的安装包：

### 🍎 macOS 用户 (macOS 10.15+)
👉 **下载文件：`MarioMakeChat-Mac.dmg`**
*   **安装步骤**：双击挂载 dmg，将“墨墨AI”拖入 Applications 文件夹。
*   **⚠️ 解除拦截**：首次打开若提示“已损坏”，请在终端运行：
    `sudo xattr -cr /Applications/墨墨AI.app`

### 🪟 Windows 用户 (Windows 10/11)
👉 **请点击此处下载：[前往 Actions 获取最新的 Windows 安装包](https://github.com/wenbofeng/MarioMakeChat/actions)**
*(进入页面后，点击最新一次绿色的 `Build Windows EXE` 记录，在页面最底部点击 `MarioMakeChat-Windows.zip` 即可下载)*

### 🐧 Linux / 源码开发者
推荐直接克隆源码运行（请确保安装 Python 3.10+）：
```bash
git clone https://github.com/wenbofeng/MarioMakeChat.git
cd MarioMakeChat
chmod +x install.sh
./install.sh
