import importlib.metadata


# --- 补丁开始：解决 PyInstaller 打包后找不到 werkzeug 元数据的问题 ---
try:
    importlib.metadata.version("werkzeug")
except importlib.metadata.PackageNotFoundError:
    class FakeDistribution:
        version = "3.0.0"  # 随便填个版本号
    _original_distribution = importlib.metadata.distribution
    def _patched_distribution(name):
        if name == "werkzeug":
            return FakeDistribution()
        return _original_distribution(name)
    importlib.metadata.distribution = _patched_distribution


import threading
import time
import webbrowser
import rumps
import server  # 导入你的 server.py

class MarioMakeApp(rumps.App):
    def __init__(self):
        # 初始化菜单栏图标，标题叫“墨墨”，不显示默认图标
        super(MarioMakeApp, self).__init__("墨墨", quit_button="退出墨墨")
        self.menu = ["打开网页"]
        
        # 在后台线程启动 Flask
        threading.Thread(target=self.start_server, daemon=True).start()

    def start_server(self):
        import threading
        import time
        import server

        # 1. 先在后台启动 Flask，让它立刻开始跑
        def run_flask():
            server.app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)

        threading.Thread(target=run_flask, daemon=True).start()

        # 2. 等待 3 秒，确保 Flask 完全启动
        time.sleep(3)

        # 3. 调用 macOS 系统原生命令打开浏览器（比 webbrowser 模块更稳）
        import subprocess
        subprocess.run(["open", "http://127.0.0.1:5001"])

    @rumps.clicked("打开网页")
    def open_page(self, _):
        webbrowser.open("http://127.0.0.1:5001")

if __name__ == "__main__":
    app = MarioMakeApp()
    app.run()
