import threading
import time
import webbrowser
import sys
import os
import server

# 🛡️ 防迷路补丁：让程序在临时目录读取资源，但在 exe 所在目录读取模型等外部文件
if getattr(sys, 'frozen', False):
    # 打包后的临时解压目录 (放代码和网页)
    BUNDLE_DIR = sys._MEIPASS
    # 打包后的真实运行目录 (放 .gguf 模型和用户数据)
    APP_DIR = os.path.dirname(sys.executable)
    os.chdir(BUNDLE_DIR)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = BUNDLE_DIR

# 🚀 启动 Flask 服务的函数
def run_flask():
    time.sleep(1)
    server.app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)

# ==========================================
# 🍎 Mac 专属逻辑：使用 rumps (菜单栏)
# ==========================================
if sys.platform == "darwin":
    import rumps

    class MarioMakeApp(rumps.App):
        def __init__(self):
            super(MarioMakeApp, self).__init__("墨墨", quit_button="退出墨墨")
            self.menu = ["打开网页"]
            threading.Thread(target=self.start_server, daemon=True).start()

        def start_server(self):
            time.sleep(1)
            webbrowser.open("http://127.0.0.1:5001")
            server.app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)

        @rumps.clicked("打开网页")
        def open_page(self, _):
            webbrowser.open("http://127.0.0.1:5001")

    if __name__ == "__main__":
        app = MarioMakeApp()
        app.run()

# ==========================================
# 🪟 Windows 专属逻辑：使用 pystray (系统托盘)
# ==========================================
else:
    import pystray
    from PIL import Image, ImageDraw

    def create_image():
        # 生成一个简单的托盘图标（如果没有现成的 .ico 文件）
        image = Image.new('RGB', (64, 64), color=(30, 30, 30))
        d = ImageDraw.Draw(image)
        d.text((20, 20), "墨", fill=(0, 255, 204))
        return image

    def on_open(icon, item):
        webbrowser.open("http://127.0.0.1:5001")

    def on_quit(icon, item):
        icon.stop()
        os._exit(0) # 强制退出所有线程

    if __name__ == "__main__":
        # 启动后台服务
        threading.Thread(target=run_flask, daemon=True).start()
        
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:5001")
        
        # 创建 Windows 托盘图标
        # 如果有图标文件，改成 Image.open("icon.ico")
        menu = pystray.Menu(
            pystray.MenuItem('打开网页', on_open, default=True),
            pystray.MenuItem('退出墨墨', on_quit)
        )
        icon = pystray.Icon("MarioMakeChat", create_image(), "墨墨 AI", menu)
        icon.run()