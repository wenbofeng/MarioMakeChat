import os
import zipfile

BACKUP_DIR = "./backups"

backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith(".zip")])
if not backups:
    print("❌ 没有找到备份")
    exit()

print("可用的备份：")
for i, b in enumerate(backups[-10:], 1):
    print(f"  {i}. {b}")

choice = input("选择要恢复的备份编号（回车=最新）：").strip()
if choice:
    target = backups[-10:][int(choice) - 1]
else:
    target = backups[-1]

path = os.path.join(BACKUP_DIR, target)
with zipfile.ZipFile(path, "r") as zf:
    zf.extractall(".")
print(f"✅ 已从 {target} 恢复")