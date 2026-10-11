# MMAI 配置说明

## 上下文窗口（CTX_SIZE）

**值**：8192

**含义**：模型一次能处理的最大 token 数。

**怎么改**：在 `server.py` 顶部修改 `CTX_SIZE`。

---

## CPU 线程数（THREADS）

**值**：4

**含义**：并行计算的线程数量。

**怎么改**：在 `server.py` 顶部修改 `THREADS`。