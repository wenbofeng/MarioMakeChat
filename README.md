# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue)](https://github.com/wenbofeng/MarioMakeChat)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blueviolet)](https://github.com/wenbofeng/MarioMakeChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/wenbofeng/MarioMakeChat)](https://github.com/wenbofeng/MarioMakeChat/releases)

> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库、Ollama 热切换与 Scratch 极速联动！现已完美支持 macOS 与 Windows 双平台发布！

## 🚀 V10.1.0 Pro 3FS 震撼发布
本次更新带来了三个史诗级 Pro 功能：
1. 🧠 **模型热切换**：支持在 1.5B / 3B 本地模型与 Ollama 引擎间无缝动态切换，按需分配内存，告别卡顿！
2. ⚡ **Scratch 极速联动**：底层重构为 WebSocket 双向通信，内置防丢包队列，实现 TurboWarp 毫秒级实时交互！
3. 📦 **一键安装脚本**：针对源码运行用户（Linux/Mac），提供全自动环境配置脚本，一键搞定所有依赖。

## 📥 下载与安装 (Download & Install)

请前往 [Releases](https://github.com/wenbofeng/MarioMakeChat/releases) 页面，根据你的操作系统选择对应的安装包：

本次发布包含 macOS 和 Windows 双平台独立运行包，无需配置任何 Python 环境，下载即用！

### 🍎 macOS 用户 (macOS 10.15+)
👉 **下载文件：`墨墨AI_v10.1.0.dmg`**

*   **安装步骤**：双击挂载 dmg，将“墨墨AI”拖入 Applications 文件夹。
*   **⚠️ 解除拦截**：首次打开若提示“已损坏”，请在终端运行：`sudo xattr -cr /Applications/墨墨AI.app`
*   **SHA256 校验码**：
    `7b1877829a3fb61f3904ea107d92a3c599dcc9a72837b3344ae19e5f76be552d`

### 🪟 Windows 用户 (Windows 10/11)
👉 **下载文件：`MarioMakeChat-Windows.zip`**

*   **安装步骤**：解压后双击运行 `MarioMakeChat.exe`。程序将静默驻留在右下角系统托盘。
*   **⚠️ 解除拦截**：若提示“Windows 已保护你的电脑”，点击“更多信息” -> “仍要运行”。
*   **SHA256 校验码**：
    `14d6540a5012a926feeb3aa1701cf88b3a504b8844f3197c01d430a031414ff5`

### 🐧 Linux / 源码开发者
推荐直接克隆源码运行（请确保安装 Python 3.10+）。我们为你准备了**一键安装脚本**，请在终端依次执行以下命令：
`git clone https://github.com/wenbofeng/MarioMakeChat.git`
`cd MarioMakeChat`
`chmod +x install.sh`
`./install.sh`
*(安装完成后，运行 `python server.py` 启动)*

## ✨ 核心特性 (Features)
- 🧠 **完全离线**：基于 llama-cpp-python 与 Ollama，断网状态下依然能陪你聊天。
- 🔄 **多模型热切换**：支持极速切换 1.5B/3B 模型或切换至 Ollama 思考模型，低配电脑也能完美运行。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，通过 WebSocket 让你的游戏角色拥有极低延迟的 AI 大脑。
- 🎨 **极客定制**：支持情绪感知、自定义人设、代码高亮、多用户隔离、划词助手与快捷指令。
- ☁️ **云端自动打包**：利用 GitHub Actions 实现 Windows/Mac 跨平台自动构建。

## 🚀 极客整活 (Geek Out)
本项目的底层大模型引擎基于 **llama.cpp** 编译。在 Mac 环境下，我们成功编译了纯血 C++ 引擎，并实现了极速本地推理。
- **纯本地模型调用**：在没有 Python 中间件的情况下，引擎依然能以 **4.7 t/s** 的速度输出内容。
- **Minecraft 自动化联动**：通过 Python 脚本监听、调用本地 API，并利用 Mac 原生 AppleScript 将 AI 的指令直接输入到《我的世界》聊天框中，实现“赛博言出法随”。

## 🙏 致谢 (Credits)

本项目之所以能够完全离线运行，得益于以下开源团队的无私奉献：
- **Qwen 团队**：感谢阿里云开源 Qwen2.5 模型。
  *特别感谢 Qwen2.5 技术报告的 58 位底层研发者：杨安、杨宝松、惠斌元、郑波、余博文、常周、李成鹏、李成远、刘大一恒、黄飞、董冠廷、魏浩然、林焕、唐家龙、王家林、杨健、屠建宏、张建伟、马建新、徐金泽、周景仁、白金泽、何金正、林俊阳、党凯、陆克明、陈克勤、杨可欣、李梅、薛明峰、倪娜、张培、王鹏、彭茹、门锐、高瑞泽、林润吉、王士杰、白帅、谭斯南、朱天航、李天浩、刘天宇、葛文斌、邓晓东、周小欢、任兴章、张新宇、魏希品、任宣成、范杨、姚洋、张宜昌、万宇、褚云飞、刘玉琼、崔泽宇、张真如、范志豪。*
- **llama.cpp 团队**：感谢 ggml-org 提供底层 C++ 推理引擎。
- **开源社区**：感谢所有在开源社区默默奉献的极客们。

## 📄 开源协议 (License)
本项目采用 [MIT License](LICENSE) 协议开源。你可以自由地使用、修改和分发。

---
*Made with ❤️ by FMC SMO (A 3rd-grade developer)*
