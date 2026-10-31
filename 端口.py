import requests
import time
import subprocess
import sys


def ask_momo(question):
    url = "http://127.0.0.1:5001/v1/chat/completions"
    # 极其关键的设定：逼迫 AI 只输出指令！
    payload = {
        "messages": [
            {
                "role": "system",
                "content": """你是一个Minecraft原版指令生成器。你只能输出合法的Minecraft指令，绝对不能发明指令，绝对不能包含中文解释或格式符号！
    请严格参考以下分类和语法：

    【给物品】
    语法：/give @p minecraft:<物品ID> <数量>
    示例：/give @p minecraft:diamond 64
    示例：/give @p minecraft:diamond_sword 1

    【给药水效果】
    语法：/effect give @p minecraft:<效果ID> <持续秒数> <等级>
    示例：/effect give @p minecraft:night_vision 600 1
    示例：/effect give @p minecraft:speed 300 2

    【天气与时间】
    示例：/time set day
    示例：/weather clear
    示例：/weather thunder

    【传送与方块】
    示例：/tp @p ~ ~10 ~
    示例：/setblock ~ ~ ~ minecraft:diamond_block

    【召唤生物】
    语法：/summon minecraft:<实体ID> ~ ~ ~ （注意：坐标必须永远是 ~ ~ ~，绝对禁止在 summon 后面写 @p！）
    示例：/summon minecraft:creeper
    示例：/summon minecraft:zombie
    
    【目标选择器】针对玩家（给人东西、给玩家加buff）用 @p 或 @a。针对怪物、动物、村民（杀怪、召唤、修改实体属性）必须用 @e！

    【注意】
    1. 一次只能输出**一条**指令！绝对不能在一行里写两个 / 开头的指令！
    2. 必须使用 Minecraft 1.13+ 的新版语法。
    3. 召唤实体必须用：/summon minecraft:实体名 ~ ~ ~
    4. 不要乱造实体名字，不要使用 @v，不要给传送指令加 NBT 标签！
    5. 如果玩家要求“跳舞”，你只能输出一条药水指令，比如：/effect give @p minecraft:jump_boost 10 5
    6. 只输出指令本身，不要任何解释文字。

    你是一个Minecraft 1.20.1 原版指令生成器。
    绝对不能使用不存在的属性！例如实体没有
    LightLevel属性！
    【自定义名字】必须使用JSON
    格式：CustomName: '{"text":"名字"}'，并且加上CustomNameVisible: 1b
    【给实体穿装备】必须使用NBT标签：ArmorItems: [{}, {}, {}, {id: "minecraft:物品ID", Count: 1b}](注意：头盔是第四个)

    示例： /summon minecraft: zombie ~ ~ ~ {CustomName: '{"text":"钻石头盖"}', CustomNameVisible: 1b, ArmorItems: [{}, {}, {}, {id: "minecraft:diamond_helmet",                                                                    Count: 1b}]}
    只输出指令，不要任何解释！"""
            },
            {"role": "user", "content": question}
        ],
        "temperature": 0.2  # 温度极低，让它死板一点
    }
    try:
        res = requests.post(url, json=payload, timeout=30).json()
        ans = res['choices'][0]['message']['content']

        # 🛡️ 终极安检：只保留以 / 开头的行
        lines = ans.split('\n')
        valid_commands = []
        for line in lines:
            line = line.strip()
            if line.startswith('/'):
                # 去掉可能包含的 markdown 代码块符号
                line = line.replace('`', '')
                valid_commands.append(line)

        if not valid_commands:
            return ["/say 墨墨没有生成有效指令"]

        return valid_commands[0] if valid_commands else "/say 墨墨脑干缺失，没写出来"
    except Exception:
        return ["/say 墨墨大脑宕机了"]


def type_in_game(text):
    # 模拟按 T 键
    subprocess.run(['osascript', '-e', 'tell application "System Events" to keystroke "t"'])
    time.sleep(0.3)
    # 复制文本并粘贴
    subprocess.run(f'echo "{text}" | pbcopy', shell=True)
    subprocess.run(['osascript', '-e', 'tell application "System Events" to keystroke "v" using command down'])
    time.sleep(0.3)
    # 回车发送
    subprocess.run(['osascript', '-e', 'tell application "System Events" to key code 36'])


if __name__ == "__main__":
    print("=====================================")
    print("🧙‍♂️ 欢迎使用 墨墨AI 指令生成器！")
    print("💡 直接输入你想要的效果（如：给我64个钻石块）")
    print("⚠️ 注意：需要你有管理员权限（创造模式/作弊模式）")
    print("=====================================\n")

    while True:
        question = input("\n🧑 你要什么: ")

        if question.lower() == 'exit':
            sys.exit()

        if not question.strip():
            continue

        print("🧠 墨墨正在编写指令...")
        answer = ask_momo(question)
        print(f"🤖 生成的指令: {answer}")
        print("⌨️ 正在发送到游戏... (请确保游戏在全屏且在最前面)")

        time.sleep(1.5)
        # 注意这里：去掉了 [墨墨AI] 前缀！直接发送指令原文！
        type_in_game(answer)
        print("✅ 指令已发送，看看游戏里发生了什么！")