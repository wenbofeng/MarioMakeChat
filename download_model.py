# 改版后的 download_model.py (或者叫 scan_models.py)
import os

def scan_local_models():
    model_dir = os.path.join(os.getcwd(), "models")
    os.makedirs(model_dir, exist_ok=True)
    
    # 找出 models 文件夹下所有的 .gguf 文件
    gguf_files = [f for f in os.listdir(model_dir) if f.endswith('.gguf')]
    
    if not gguf_files:
        print("⚠️ 警告：models 文件夹里没有找到 .gguf 模型文件！")
        print(f"请把你的 1.5B-Q4、3B-Q4 等文件放到：{model_dir}")
    else:
        print(f"✅ 发现 {len(gguf_files)} 个本地模型：")
        for f in gguf_files:
            print(f" - {f}")
            
    return gguf_files