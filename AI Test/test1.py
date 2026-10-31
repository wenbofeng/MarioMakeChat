# 第一层（隐藏层）的 3 个神经元
# 假设输入 x1=1, x2=0。权重随便给的。
h1 = (1 * 0.5) + (0 * -0.2) + 0.1  # 结果 0.6
h2 = (1 * -0.8) + (0 * 0.9) + 0.5  # 结果 -0.3
h3 = (1 * 0.1) + (0 * 0.1) + 0   # 结果 0.1

# 激活函数魔法（ReLU 安检门：负数变0）
def relu(x):
    return max(0, x)

h1_out = relu(h1)  # 0.6
h2_out = relu(h2)  # 变成 0！（这个打工人被开除了）
h3_out = relu(h3)  # 0.1

# 第二层（输出层）的 1 个神经元
# 它接收第一层传过来的 h1_out, h2_out, h3_out
final_result = (h1_out * 1.2) + (h2_out * -2.0) + (h3_out * 0.5) + 0.1

print("输出结果:", final_result)

# 假设我们觉得 0.87 不够大，我们把 h1 的权重加大一点
final_result_updated = (h1_out * 1.4) + (h2_out * -2.0) + (h3_out * 0.5) + 0.1
print("调整后的结果:", final_result_updated)