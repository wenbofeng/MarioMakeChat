from PyInstaller.utils.hooks import collect_dynamic_libs, get_package_paths
import os
import sys

package_path = get_package_paths('llama_cpp')[0]
binaries = collect_dynamic_libs('llama_cpp')

if sys.platform == 'darwin':
    # Mac 下收集 .dylib
    dylib_path = os.path.join(package_path, 'llama_cpp', 'lib', 'libllama.dylib')
    if os.path.exists(dylib_path):
        binaries.append((dylib_path, 'llama_cpp/lib'))
elif sys.platform == 'win32':
    # Windows 下收集 .dll
    dll_path = os.path.join(package_path, 'llama_cpp', 'lib')
    if os.path.exists(dll_path):
        # 将整个 lib 文件夹里的 dll 都收集进去
        for f in os.listdir(dll_path):
            if f.endswith('.dll'):
                binaries.append((os.path.join(dll_path, f), 'llama_cpp/lib'))