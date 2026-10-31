import random
import time
from concurrent.futures import ThreadPoolExecutor

def neuron(num=1000):
    x1 = 1
    x2 = 0

    h_outputs = []

    number_of_neurons = 1000

    for i in range(number_of_neurons):
        w1 = random.uniform(-1, 1)
        w2 = random.uniform(-1, 1)
        b = random.uniform(-1, 1)
        res = (x1 * w1) + (x2 * w2) + b
        h = res if res > 0 else 0
        h_outputs.append(h)

    w_boss = []
    for i in range(1000):
        w_boss.append(random.uniform(-0.1, 0.1))
    b_boss = random.random()

    zip(h_outputs, w_boss)
    y_pred = sum(h * w for h, w in zip(h_outputs, w_boss)) + b_boss

    learning_rate = 0.1  # 学习率（每次迈步的大小）
    y_true = 1.0

    # 让 AI 自己跑 10 次，自己调整参数
    for epoch in range(1, num + 1):
        # 1. 先算一遍现在的预测值
        y_pred = sum(h * w for h, w in zip(h_outputs, w_boss)) + b_boss

        # 2. 算一下误差（要调整多少）
        error = y_true - y_pred

        # 3. 核心魔法：调整大老板的偏置！
        # 如果预测值太小（error是正数），b_boss 就加上去；
        # 如果预测值太大（error是负数），b_boss 就减下来。
        b_boss = b_boss + (learning_rate * error)

        # 4. 算一下新的 Loss
        loss = (y_true - y_pred) ** 2

        return f"第 {epoch} 轮 | 预测: {y_pred:.4f} | 误差 Loss: {loss:.4f} | 当前 b_boss: {b_boss:.4f}"


print("🚀 开始单线程测试...")
start = time.time()
for i in range(1, 6):
    res = neuron(100)
    print(f"任务 {i} 完成: {res}")
end = time.time()
print(f"单线程耗时: {end - start:.4f} 秒\n")

print("🔥 开始线程池测试（同时跑5个）...")
start = time.time()
# 创建一个 5 人的线程池
with ThreadPoolExecutor(max_workers=5) as pool:
    # map 会自动把 [1, 2, 3, 4, 5] 当作参数传给 neuron？不对，这里我们直接提交 5 个任务。
    # 用 pool.map 传给函数 5 个 epoch 参数（每个都是 100）
    results = pool.map(neuron, [100, 100, 100, 100, 100])

    for i, res in enumerate(results):
        print(f"线程任务 {i + 1} 完成: {res}")

end = time.time()
print(f"线程池耗时: {end - start:.4f} 秒")