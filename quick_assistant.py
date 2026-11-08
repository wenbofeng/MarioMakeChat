import subprocess
import requests
from pynput import keyboard
from pynput.keyboard import Controller, Key
import threading
import time

MOMO_API = "http://127.0.0.1:5001/v1/chat/completions"

# 👇 用 pynput 自带的控制器，比 AppleScript 更底层、更猛
kb_controller = Controller()

def get_selected_text():
    # 塞入假数据
    subprocess.run('echo "COPY_FAILED" | pbcopy', shell=True)
    
    # 👇 用 pynput 模拟按下 Cmd+C
    with kb_controller.pressed(Key.cmd):
        kb_controller.press('c')
        kb_controller.release('c')
        
    time.sleep(0.5)
    
    text = subprocess.run(['pbpaste'], capture_output=True, text=True).stdout
    if "COPY_FAILED" in text:
        return ""
    return text.strip()

def ask_momo(question):
    payload = {
        "messages": [
            {"role": "system", "content": "你是一个极简的桌面助手。请用最简短的几句话直接回答用户的问题，不要废话。"},
            {"role": "user", "content": question}
        ],
        "temperature": 0.5
    }
    try:
        res = requests.post(MOMO_API, json=payload, timeout=60).json()
        return res['choices'][0]['message']['content'].strip()
    except Exception as e:
        return f"请求失败: {e}"

def show_notification(text):
    text = text.replace('"', '\\"')
    if len(text) > 200:
        text = text[:200] + "..."
    script = f'display notification "{text}" with title "墨墨 AI" sound name "Ping"'
    subprocess.run(['osascript', '-e', script])

def on_activate():
    def run():
        print("\n⌨️ 触发成功！正在尝试复制...")
        text = get_selected_text()
        if not text:
            print("❌ 复制失败！请确保你用鼠标选中了文字！")
            return
        print(f"📝 提取成功: {text[:15]}... 呼叫墨墨中...")
        answer = ask_momo(text)
        print(f"💬 回答: {answer}\n")
        show_notification(answer)
    threading.Thread(target=run).start()

def on_press(key):
    # 这里不用打印每个按键了，免得刷屏，只关注 F9
    if key == keyboard.Key.f9:
        on_activate()

def on_release(key):
    pass

if __name__ == "__main__":
    print("=====================================")
    print("🕵️ 终极必杀版已启动！")
    print("👉 快捷键：F9")
    print("👉 🚨 注意：请在【浏览器】里用鼠标选中文字，然后按 F9！")
    print("👉 🚨 按完 F9 后，眼睛看回终端屏幕，别在终端里乱敲了！")
    print("=====================================")
    
    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()