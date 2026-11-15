# -*- mode: python ; coding: utf-8 -*-
import platform
import os
import sys
from PyInstaller.utils.hooks import collect_dynamic_libs, get_package_paths

# 1. 先定义一个独立的 binaries 列表
my_binaries = []

if platform.system() == "Windows":
    try:
        my_binaries += collect_dynamic_libs('llama_cpp')
    except Exception as e:
        print(f"Warning: Could not collect llama_cpp DLLs: {e}")
elif platform.system() == "Darwin":
    package_path = get_package_paths('llama_cpp')[0]
    dylib_path = os.path.join(package_path, 'llama_cpp', 'lib', 'libllama.dylib')
    if os.path.exists(dylib_path):
        my_binaries.append((dylib_path, 'llama_cpp/lib'))

# 2. 把收集好的 my_binaries 传给 Analysis
a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=my_binaries, # 👈 这里使用上面收集的列表
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=[
        'flask_sock',
        'llama_cpp',
        # 'flask_cors', # 👈 你终端报错说找不到这个库，我帮你注释掉了，不影响运行
    ],
    hookspath=['./hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch',
        'torchvision',
        'torchaudio',
        'sklearn',
        'scipy',
        'pandas',
        'cv2',
        'matplotlib',
        'tensorboard',
        'IPython',
        'notebook',
    ],
    noarchive=False,
    optimize=0,
)
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
    console=True,
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
        icon=None,
        bundle_identifier='com.fmcsmo.mariomakechat',
        info_plist={
            'CFBundleExecutable': 'MarioMakeChat',
            'CFBundleShortVersionString': '10.2.0',
            'NSHighResolutionCapable': 'True',
        },
    )