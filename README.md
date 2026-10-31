# 🤖 MarioMakeChat (墨墨) - 纯本地 AI 助手

⚡ 完全离线、无需联网、保护隐私的 macOS 专属中文 AI 助手。基于 Qwen2.5 与 Flask 打造，支持本地 RAG 知识库与 Scratch 联动！

## 📥 下载与安装

👉 **[点击这里下载 MarioMakeChat_v9.0.1.dmg (约 451 MB)](https://github.com/wenbofeng/MarioMakeChat/releases/download/v9.0.1/MarioMakeChat_v9.dmg)**

**文件完整性校验 (SHA256):**
`52643a30db509f940a7052af6bc5fc1fd1ad416de82a3ad6c4c5e6b834b095d2`

### 💻 macOS 安装指南
1. 下载 `.dmg` 文件后双击打开。
2. 将 **MarioMakeChat.app** 拖拽到 **Applications (应用程序)** 文件夹中。
3. **⚠️ 首次启动提示“已损坏”？** 由于本项目为个人开源项目，未购买苹果开发者签名。请打开 Mac 终端，运行以下命令解除拦截，然后就可以双击完美运行啦！（应用会静默驻留在右上角菜单栏）。

```bash
sudo xattr -cr /Applications/MarioMakeChat.app
```

## ✨ 核心特性
- 🧠 **完全离线**：基于 llama-cpp-python，断网状态下依然能陪你聊天。
- 📚 **本地知识库 (RAG)**：支持上传 PDF/TXT/MD，让 AI 基于你的私有文档回答。
- 🎮 **Scratch 联动**：支持 TurboWarp，内置 `momo-extension.js`，让你的游戏角色拥有 AI 大脑。
- 🎨 **极客定制**：支持情绪感知、自定义人设、代码高亮、多用户隔离与快捷指令。

## 🛠️ 开发与源码运行
如果你想在本地源码环境下运行或二次开发，请确保安装了 Python 3.10。在终端执行以下命令：

```bash
git clone https://github.com/wenbofeng/MarioMakeChat.git
cd MarioMakeChat
pip install -r requirements.txt
python server.py
```

## 📝 更新日志
### v9.0.1 (Latest)
- 🌟 发布独立的 macOS `.dmg` 安装包，一键解压即用。
- 📦 优化了 PyInstaller 打包流程，大幅缩小安装包体积（451MB）。
- 🛡️ 增强了模型路径的自动读取与容错机制。

## 📄 开源协议
本项目采用 [MIT License](LICENSE) 协议开源。

---
*Made with ❤️ by FMC SMO (A 3rd-grade developer)*