#!/usr/bin/env python3
"""
墨墨 Quick - 菜单栏快捷唤起
"""
import subprocess
import threading
import rumps
import pyperclip
import requests
from PyObjCTools import AppHelper

API = "http://127.0.0.1:5001"
DEFAULT_MODEL = "Q4_K_M ✨推荐"
TIMEOUT = 300


def _native_input(title, message, default=""):
    safe_message = message.replace('"', '\\"')
    safe_default = default.replace('"', '\\"')
    safe_title = title.replace('"', '\\"')
    script = f'''
    tell application "System Events"
        activate
        set result to display dialog "{safe_message}" with title "{safe_title}" default answer "{safe_default}" buttons {{"取消", "发送"}} default button "发送"
        return text returned of result
    end tell
    '''
    try:
        r = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=600
        )
        if r.returncode != 0:
            return None
        return r.stdout.strip()
    except Exception as e:
        print(f"osascript 出错：{e}")
        return None


# v6.1.3: 把 UI 调用丢回主线程
def safe_notify(title, subtitle, message):
    AppHelper.callAfter(rumps.notification, title, subtitle, message)

def safe_alert(title, message):
    AppHelper.callAfter(rumps.alert, message, title=title)


class MomoQuick(rumps.App):
    def __init__(self):
        super().__init__("🍄", quit_button="退出墨墨")
        self.menu = [
            "💬 问墨墨…",
            "📋 问剪贴板内容",
            None,
            "🧹 清空墨墨记忆",
            "🌐 打开完整界面",
        ]

    @rumps.clicked("💬 问墨墨…")
    def ask(self, _):
        q = _native_input("🍄 墨墨", "想问什么？")
        if not q:
            return
        self._do_ask(q)

    @rumps.clicked("📋 问剪贴板内容")
    def ask_clipboard(self, _):
        content = pyperclip.paste()
        if not content.strip():
            rumps.alert("剪贴板是空的")
            return
        preview = content[:50].replace("\n", " ")
        q_prefix = _native_input(
            "🍄 墨墨 · 剪贴板",
            f"剪贴板（前50字）：{preview}…\n\n用什么方式处理？",
            default="请解释以下内容："
        )
        if q_prefix is None:
            return
        q_prefix = q_prefix.strip() or "请解释以下内容："
        self._do_ask(f"{q_prefix}\n\n{content}")

    @rumps.clicked("🧹 清空墨墨记忆")
    def clear_memory(self, _):
        try:
            requests.post(f"{API}/reset", timeout=5)
            safe_notify("墨墨", "已清空", "当前对话记忆已清空")
        except Exception as e:
            safe_alert("失败", str(e))

    @rumps.clicked("🌐 打开完整界面")
    def open_full(self, _):
        import webbrowser
        webbrowser.open(API)

    def _do_ask(self, question):
        def _run():
            # 更新标题也要在主线程
            AppHelper.callAfter(setattr, self, "title", "🍄⏳")
            try:
                # v6.1.3: 改成 json= 而不是 data=
                res = requests.post(
                    f"{API}/chat",
                    json={
                        "message": question,
                        "model": DEFAULT_MODEL,
                        "web": False,
                    },
                    stream=True,
                    timeout=TIMEOUT,
                )
                res.raise_for_status()

                full = ""
                for chunk in res.iter_content(chunk_size=None, decode_unicode=True):
                    if chunk:
                        full += chunk

                full = full.strip()
                if not full:
                    safe_notify("墨墨", "空回复", "模型没有输出内容")
                    return

                pyperclip.copy(full)
                preview = full[:80].replace("\n", " ")
                if len(full) > 80:
                    preview += "…"
                safe_notify("墨墨 · 已复制到剪贴板", preview, "点菜单栏 🍄 可以再问")

            except requests.exceptions.ConnectionError:
                safe_alert("连不上墨墨", "请先启动 server.py")
            except Exception as e:
                safe_alert("出错", str(e))
            finally:
                AppHelper.callAfter(setattr, self, "title", "🍄")

        threading.Thread(target=_run, daemon=True).start()


if __name__ == "__main__":
    MomoQuick().run()