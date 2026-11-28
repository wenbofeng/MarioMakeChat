import time
import sys

def print_colored(text, color_code):
    # 使用 ANSI 转义序列改变终端颜色
    print(f"\033[{color_code}m{text}\033[0m")

def birthday_animation():
    # 清屏
    print("\033[2J\033[H")
    
    # 打字机特效打印祝福
    msg = "Happy Birthday to FMC SMO!\n"
    for char in msg:
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(0.1)
    print("\n")
    
    # 画一个极客版的 ASCII 蛋糕
    cake = """
       (  (  (  )
        )  )  )  (
       (  (  (  )
      =============
      |  🎂 🎂 🎂  |
      |  🕯️ 🕯️ 🕯️  |
      =============
    """
    print_colored(cake, "36") # 36 是青色
    time.sleep(0.5)
    print_colored("✨ 祝你代码永无 Bug，模型永不 OOM！", "33") # 33 是黄色
    print_colored("✨ 祝你微积分全对，图灵线代一看就懂！", "32") # 32 是绿色

if __name__ == "__main__":
    birthday_animation()