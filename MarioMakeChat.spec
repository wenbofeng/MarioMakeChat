# -*- mode: python ; coding: utf-8 -*-

import platform


a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[], # 保持为空，我们用下面的逻辑动态收集
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=[
        'flask_sock',
        'flask_cors',
        'llama_cpp',
    ],
    hookspath=['./hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

# --- 跨平台动态库收集逻辑 ---
from PyInstaller.utils.hooks import collect_dynamic_libs, get_package_paths
import os
import sys

if platform.system() == "Windows":
    # Windows: 收集 .dll 文件
    try:
        binaries += collect_dynamic_libs('llama_cpp')
    except Exception as e:
        print(f"Warning: Could not collect llama_cpp DLLs: {e}")
elif platform.system() == "Darwin":
    # macOS: 保留你之前的 Hook 逻辑或直接收集 .dylib
    package_path = get_package_paths('llama_cpp')[0]
    dylib_path = os.path.join(package_path, 'llama_cpp', 'lib', 'libllama.dylib')
    if os.path.exists(dylib_path):
        binaries.append((dylib_path, 'llama_cpp/lib'))
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='MarioMakeChat',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True, # 保持控制台输出，方便我们看报错
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='MarioMakeChat',
)

if platform.system() == "Darwin":
    app = BUNDLE(
        coll,
        name='MarioMakeChat.app',
        icon='mario_icon.icos', # 如果你有 .icns 格式的图标，可以把路径写在这里，比如 'icon.icns'
        bundle_identifier='com.fmcsmo.mariomakechat',
        info_plist={
            'CFBundleShortVersionString': '10.1.0',
            'NSHighResolutionCapable': 'True',
            'LSUIElement': '0', # 如果你想隐藏顶部菜单栏的 Python 图标，改成 '1'
        },
    )