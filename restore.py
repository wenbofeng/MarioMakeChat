#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
墨墨AI 备份恢复脚本

从 ./backups 里挑一个 zip 恢复。
"""

import os
import sys
import zipfile

# ── 路径全部锚定到脚本所在目录，不依赖 CWD ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(SCRIPT_DIR, "backups")
TARGET_DIR = SCRIPT_DIR

# ── 安全阈值 ──
MAX_FILES = 20000
MAX_TOTAL_BYTES = 5 * 1024 ** 3   # 解压后总大小上限 5GB


def safe_extract(zip_path, target_dir):
    """
    安全解压：
    - 拒绝 symlink
    - 拒绝路径越界（../ 和绝对路径）
    - 限制条目数与解压后总大小（防 zip bomb）
    """
    target_dir = os.path.abspath(target_dir)
    total_bytes = 0
    file_count = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        # 先测 zip 是否损坏
        bad = zf.testzip()
        if bad is not None:
            raise RuntimeError(f"zip 损坏，第一个坏文件：{bad}")

        for info in zf.infolist():
            file_count += 1
            if file_count > MAX_FILES:
                raise RuntimeError(f"zip 条目过多（>{MAX_FILES}）")

            total_bytes += info.file_size
            if total_bytes > MAX_TOTAL_BYTES:
                raise RuntimeError(
                    f"解压后总大小超过 {MAX_TOTAL_BYTES / 1024**3:.1f}GB，疑似 zip bomb"
                )

            # symlink 检测：高 16 位若为 S_IFLNK(0xA000) 则拒
            if (info.external_attr >> 16) & 0xF000 == 0xA000:
                raise RuntimeError(f"拒绝解压符号链接：{info.filename}")

            # 解析目标路径，确保在 target_dir 内
            dest = os.path.abspath(os.path.join(target_dir, info.filename))
            if not (dest == target_dir or dest.startswith(target_dir + os.sep)):
                raise RuntimeError(f"路径越界：{info.filename}")

            # 目录条目
            if info.is_dir():
                os.makedirs(dest, exist_ok=True)
                continue

            # 普通文件
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with zf.open(info) as src, open(dest, "wb") as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)


def main():
    if not os.path.isdir(BACKUP_DIR):
        print(f"❌ 备份目录不存在：{BACKUP_DIR}")
        sys.exit(1)

    backups = sorted(
        f for f in os.listdir(BACKUP_DIR)
        if f.startswith("backup_") and f.endswith(".zip")
    )
    if not backups:
        print("❌ 没有找到备份")
        sys.exit(1)

    recent = backups[-10:]
    print("可用的备份（最近 10 个）：")
    for i, b in enumerate(recent, 1):
        full = os.path.join(BACKUP_DIR, b)
        size_mb = os.path.getsize(full) / 1024 / 1024
        print(f"  {i}. {b}  ({size_mb:.1f} MB)")

    choice = input("选择要恢复的备份编号（回车=最新）：").strip()

    if choice:
        try:
            idx = int(choice) - 1
        except ValueError:
            print("❌ 请输入数字")
            sys.exit(1)
        if idx < 0 or idx >= len(recent):
            print(f"❌ 编号超出范围（1-{len(recent)}）")
            sys.exit(1)
        target = recent[idx]
    else:
        target = recent[-1]

    path = os.path.join(BACKUP_DIR, target)

    print(f"\n⚠️  即将从 {target} 解压到：\n    {TARGET_DIR}")
    print("    （已有文件会被覆盖，请确认）")
    confirm = input("继续？(y/N)：").strip().lower()
    if confirm != "y":
        print("已取消")
        sys.exit(0)

    try:
        safe_extract(path, TARGET_DIR)
    except Exception as e:
        print(f"❌ 恢复失败：{e}")
        sys.exit(1)

    print(f"✅ 已从 {target} 恢复")


if __name__ == "__main__":
    main()