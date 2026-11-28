# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

MarioMakeChat (MoMo) - A completely offline, local AI assistant built for Scratch/TurboWarp.
Features: Local Qwen2.5, Vision AI, Agent Tool-calling, WebSocket integration, and a **Calculus Extension for Scratch**!
Check the README for download links!

[![macOS](https://img.shields.io/badge/macOS-10.15%2B-blue)](https://github.com/wenbofeng/MarioMakeChat)
[![Windows](https://img.shields.io/badge/Windows-10%2F11-blueviolet)](https://github.com/wenbofeng/MarioMakeChat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/wenbofeng/MarioMakeChat)](https://github.com/wenbofeng/MarioMakeChat/releases)
[![Star](https://img.shields.io/github/stars/wenbofeng/MarioMakeChat?style=social)](https://github.com/wenbofeng/MarioMakeChat)


> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库、Ollama 热切换、多模态视觉，内置 **Scratch 极速联动** 与 **微积分扩展**！现已完美支持 macOS 与 Windows 双平台独立运行。

## 🚀 V10.3.0 Pro 2FS 震撼发布
本次更新将“墨墨”的易用性与可玩性推向了新高度：
1. 🧠 **全自动模型管家**：小白福音！免去手动配置，直接在网页端一键多线程极速下载 Qwen1.5B/3B 模型，实时显示进度条。
2. 🧮 **Scratch 微积分扩展**：内置 `calculus-extension.js`，在 TurboWarp 中直接通过积木进行求导、积分和泰勒展开！真正的数学降维打击。
3. 🎙️ **语音与多模态**：支持本地语音 TTS 朗读，支持上传图片进行视觉分析（基于 Ollama llava/llama3）。
> ⚡ 完全离线、无需联网、保护隐私的 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库、Ollama 热切换、视觉多模态，以及 **Scratch 极速联动与微积分扩展**！现已完美支持 macOS 与 Windows 双平台独立运行发布！

## 🎂 V10.3.0 Birthday Edition 震撼发布
这不仅是新版本，也是三年级开发者送给自己的生日献礼！
1. 🧠 **全自动模型管家**：小白福音！网页端新增多模型一键下载（多线程 + 实时进度条），彻底告别命令行配置，一键拉取 Qwen1.5B/3B 模型。
2. 🧮 **Scratch 微积分扩展**：内置 `calculus-extension.js`，在 TurboWarp 中直接通过积木进行求导、积分和泰勒展开，真正的数学降维打击！

## 📥 下载与安装 (Download & Install)

请前往 [Releases](https://github.com/wenbofeng/MarioMakeChat/releases) 页面，或通过网盘链接下载最新版：

### 🍎 macOS 用户 (macOS 10.15+)

👉 **下载文件：`MarioMakeChat-Mac.dmg`**
*   **安装步骤**：双击挂载 dmg，将“墨墨AI”拖入 Applications 文件夹。
*   **⚠️ 解除拦截**：首次打开若提示“已损坏”，请在终端运行：
    `sudo xattr -cr /Applications/墨墨AI.app`
1. 下载 `.dmg` 文件后双击打开。
2. 将 **墨墨AI.app** 拖拽到 **Applications (应用程序)** 文件夹中。
3. **⚠️ 首次启动提示“已损坏”？** 由于本项目为个人开源项目，未购买苹果开发者签名。请打开 Mac 终端，运行以下命令解除拦截：
   `sudo xattr -cr /Applications/墨墨AI.app`
4. 再次双击即可完美运行（应用会静默驻留在右上角菜单栏）。

### 🪟 Windows 用户 (Windows 10/11)
👉 **下载 `MarioMakeChat-Windows.zip`** *(或前往 Actions 页面下载最新构建)*

1. 下载 `.zip` 后，解压到一个**纯英文路径**的文件夹中（例如 `D:\MarioMakeChat`）。
2. 双击运行文件夹内的 `MarioMakeChat.exe`。
3. **⚠️ 首次启动遇到拦截怎么办？**
   如果提示“Windows 已保护你的电脑”，点击“更多信息” -> “仍要运行”。如果被 360 拦截，请选择“添加信任”。
4. 程序会静默在右下角系统托盘常驻，并自动打开浏览器访问 `127.0.0.1:5001`。

### 🐧 Linux / 源码开发者
推荐直接克隆源码运行（请确保安装 Python 3.10+）。在终端依次执行：
`git clone https://github.com/wenbofeng/MarioMakeChat.git`
`cd MarioMakeChat`
`chmod +x install.sh`
`./install.sh`

## ✨ 核心特性 (Features)
- 🧠 **完全离线**：基于 llama-cpp-python 与 Ollama，断网状态下依然能陪你聊天。
- 🔄 **多模型热切换**：网页端一键下载并切换 1.5B/3B 模型。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，通过 WebSocket 让你的游戏角色拥有极低延迟的 AI 大脑。
- 🧮 **微积分扩展**：内置 `calculus-extension.js`，在 Scratch 里画泰勒展开曲线！
- 🔄 **一键模型管家**：网页端零门槛下载 1.5B/3B 模型，实时进度条，自动热加载。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，通过 WebSocket 让你的游戏角色拥有极低延迟的 AI 大脑。
- 🧮 **微积分扩展**：内置 `calculus-extension.js`，在 Scratch 里画泰勒展开曲线，算微积分！
- 🎨 **极客定制**：支持情绪感知、自定义人设、代码高亮、多用户隔离、划词助手与快捷指令。

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
*如果这个项目对你有帮助，欢迎点一个 ⭐ Star 支持一下！*
