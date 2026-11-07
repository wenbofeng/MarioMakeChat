import threading
import time
import webbrowser
import sys
import server  # 导入你的 server.py

# 判断当前是不是 Mac 系统
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

# 如果是 Windows 系统
else:
    if __name__ == "__main__":
        # 在后台启动 Flask，然后自动打开浏览器
        threading.Thread(target=lambda: server.app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False),
                         daemon=True).start()
        time.sleep(2)
        webbrowser.open("http://127.0.0.1:5001")

        # 保持主线程运行
        while True:
            time.sleep(1)