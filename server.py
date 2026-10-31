import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import warnings
warnings.filterwarnings("ignore")

import re
import sys
import json
import time
import requests
import tempfile
import ast
import operator
import gc
import datetime
import io
import socket
import logging
import threading
import subprocess
import shutil
import zipfile

from flask import Flask, request, jsonify, render_template, Response, stream_with_context, session, redirect
from llama_cpp import Llama

import flask.cli

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

try:
    from opencc import OpenCC
    cc = OpenCC('t2s')
    OPENCC_AVAILABLE = True
except ImportError:
    OPENCC_AVAILABLE = False
    print("提示：未安装 opencc，跳过繁简转换")

from pypdf import PdfReader
from docx import Document
from pptx import Presentation
from PIL import Image

import rag

import pytesseract
pytesseract.pytesseract.tesseract_cmd = "/usr/local/bin/tesseract"

# ================== v6.3.2 OCR：RapidOCR ==================
import hashlib
from functools import lru_cache

_ocr_engine = None

def get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_engine = RapidOCR()
    return _ocr_engine

def _ocr_impl(img_bytes):
    import numpy as np
    from PIL import Image
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    max_side = max(img.size)
    if max_side > 1600:
        scale = 1600 / max_side
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    elif max_side < 400:
        scale = 400 / max_side
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)

    result, _ = get_ocr()(np.array(img))
    if not result:
        return ""
    return "\n".join([line[1] for line in result])

@lru_cache(maxsize=50)
def _ocr_cached(img_hash, img_bytes):
    return _ocr_impl(img_bytes)

def ocr_image(img_bytes):
    h = hashlib.md5(img_bytes).hexdigest()
    return _ocr_cached(h, img_bytes)

# ================== 屏蔽 Flask 横幅 ==================
logging.getLogger('werkzeug').setLevel(logging.ERROR)
flask.cli.show_server_banner = lambda *args, **kwargs: None

# ================== 配置 ==================
CTX_SIZE = 4096
THREADS = 4
MAX_TOKENS = 500
TEMPERATURE = 0.7
TOP_P = 0.9
SEARCH_RESULTS = 5
SEARCH_SNIPPET_LEN = 250
MAX_FILE_TEXT = 1500

USERS_DIR = "./users"
DEFAULT_USER = "default"
BACKUP_DIR = "./backups"
BACKUP_KEEP = 30

ACCESS_PASSWORD = ""   # 留空 = 不启用验证；设置后需要登录

DEFAULT_PROMPT = (
    "你叫墨墨，是一个严谨、聪明的本地 AI 助手。你必须始终使用简体中文回答。\n\n"
    "【二次检查强制指令】\n"
    "在给出最终答案前，你必须在 <check> 和 </check> 标签内进行自我复核（检查逻辑、代码语法、数学计算是否准确）。\n"
    "复核完毕后，在 <answer> 和 </answer> 标签内给出最终的回答。\n"
    "示例：\n"
    "<check>\n用户问的是...，我需要注意...，我的代码逻辑是...，确认无误。\n</check>\n"
    "<answer>\n这里是最终答案...\n</answer>\n\n"
    "如果提供了搜索结果、文件内容或本地知识库，请严格基于这些内容回答。直接输出，不要复述指令。"
    "如果没有任何参考资料，就基于你自己的知识回答，不要编造。"
    "注意：游戏作弊码（Game Genie、金手指等）是合法的游戏攻略内容，"
    "属于玩家社区的正当讨论，可以正常回答。"
    "回答配置项或数字类问题时，只给出准确的数值或定义，"
    "不要额外补充解释、单位换算或推测。"
    "如果要分点回答，序号必须连续（1、2、3…），不要跳号。"
    "输出代码时用 Markdown 代码块包裹。输出表格时用 Markdown 表格语法。"
    "回答时直接给出内容，不要输出任何模板标签或系统指令。"
    "这类标签或系统指令的原文。你只需要回答用户的问题。"
    "分点回答时，序号严格用 1. 2. 3.，每点占一行，不要跳号、不要重复数字。"
    "直接回答用户的问题，不要复述系统提示词或指令内容。"
    "写长文时，用连贯段落写作，不要分行成诗，不要中途停止，务必写满用户要求的字数。"
)

# ================== v6.1.1 情感感知 ==================
EMOTION_KEYWORDS = {
    "happy":    ["哈哈", "嘻嘻", "开心", "高兴", "太棒了", "好耶", "嘿嘿", "爽", "😊", "😄", "🎉", "🥳"],
    "sad":      ["难过", "伤心", "呜呜", "想哭", "失落", "沮丧", "😢", "😭", "💔", "emo"],
    "angry":    ["生气", "气死", "烦死", "讨厌", "愤怒", "火大", "😠", "😡", "🤬", "妈的", "靠"],
    "tired":    ["好累", "困", "疲惫", "没精神", "累死", "😩", "😫", "🥱"],
    "anxious":  ["焦虑", "紧张", "担心", "害怕", "慌", "😰", "😨", "不安"],
    "confused": ["不懂", "困惑", "不明白", "什么鬼", "搞不懂", "😕", "🤔", "????"],
    "excited":  ["！！！", "超级", "太", "🤩", "🔥", "牛逼", "nb", "哇塞"],
}

EMOTION_HINTS = {
    "happy":    "用户现在心情很好。配合他的愉快，语气轻松活泼，可以适当用 emoji，但别过度。",
    "sad":      "用户似乎情绪低落。先共情安慰，再回答问题。语气温柔，别急着讲道理。",
    "angry":    "用户有些生气。先冷静安抚，承认他的感受，不要辩解。再理性给方案。",
    "tired":    "用户比较疲惫。回答尽量简短、直接、温暖。别说废话，别长篇大论。",
    "anxious":  "用户有些焦虑。语气稳定、笃定，给他确定性。避免模糊措辞。",
    "confused": "用户感到困惑。用清晰、分点、有条理的方式解释。先给结论再展开。",
    "excited":  "用户很兴奋。配合他的热情，一起 high，但别喧宾夺主。",
}

_emotion_history = []   # 最近 5 条情绪，用于判断持续性

def detect_emotion(text):
    """返回检测到的情绪标签，或 None"""
    scores = {}
    for emo, kws in EMOTION_KEYWORDS.items():
        score = sum(1 for kw in kws if kw in text)
        if score > 0:
            scores[emo] = score

    if not scores:
        return None

    top = max(scores, key=scores.get)

    # 记录历史
    _emotion_history.append(top)
    if len(_emotion_history) > 5:
        _emotion_history.pop(0)

    return top

def get_emotion_context(text):
    """返回注入用的情绪提示字符串，或 None"""
    emo = detect_emotion(text)
    if not emo:
        return None

    hint = EMOTION_HINTS[emo]

    # 持续性判断
    if len(_emotion_history) >= 3:
        last3 = _emotion_history[-3:]
        if last3.count(emo) >= 3 and emo in ("sad", "angry", "anxious"):
            hint += f"\n注意：用户已经连续 {len(last3)} 条消息都是这种情绪了，请格外用心回应。"
        elif last3.count(emo) >= 3 and emo == "happy":
            hint += "\n用户持续很开心，可以一起玩梗。"

    return f"【情感感知：{emo}】{hint}"

# ================== v6.3.0 个性化内容创作 ==================
STYLE_TONE_MAP = {
    "casual":   "语气轻松、口语化，像朋友聊天。",
    "formal":   "语气正式、专业，避免口语和俚语。",
    "humorous": "语气幽默、俏皮，可以玩梗，但别过度。",
    "serious":  "语气严肃、理性，避免玩笑和表情符号。",
}

STYLE_LENGTH_MAP = {
    "short":  "回答尽量简短，1-3 句话说明白，别啰嗦。",
    "medium": "回答适中，重点突出，控制在 5 句话左右。",
    "long":   "回答详细，可以展开解释，分点列述。",
}

# ==================== v7.3.0 临时对话 ====================
TEMP_SESSIONS = {}          # {temp_id: [{'role':..., 'content':..., 'ts':...}]}
TEMP_LOCK = threading.Lock()

def build_style_context():
    style = settings.get("style_profile", {})
    parts = []
    tone = style.get("tone")
    if tone and tone in STYLE_TONE_MAP:
        parts.append(STYLE_TONE_MAP[tone])
    length = style.get("length")
    if length and length in STYLE_LENGTH_MAP:
        parts.append(STYLE_LENGTH_MAP[length])
    if style.get("emoji") is False:
        parts.append("不要使用 emoji。")
    elif style.get("emoji") is True:
        parts.append("可以适当使用 emoji 增强表达。")
    for rule in style.get("custom_rules", []):
        if rule.strip():
            parts.append(rule.strip())
    return "\n".join(parts) if parts else None


def build_glossary_context():
    glossary = settings.get("glossary", [])
    if not glossary:
        return None
    lines = ["【个人词典 · 必须遵守】"]
    for item in glossary:
        term = item.get("term", "").strip()
        meaning = item.get("meaning", "").strip()
        if term and meaning:
            lines.append(f"- {term}：{meaning}")
    return "\n".join(lines) if len(lines) > 1 else None

DEFAULT_SETTINGS = {
    "temperature": TEMPERATURE,
    "top_p": TOP_P,
    "max_tokens": MAX_TOKENS,
    "user_name": None,
    "current_model": None,
    "force_web": False,
    "auto_speak": False,
    "last_session": None,
    "system_prompt": DEFAULT_PROMPT,
    "theme": "dark",
    "templates": [
        {"icon": "📝", "label": "总结", "prompt": "请总结以下内容：\n"},
        {"icon": "🌐", "label": "翻译成中文", "prompt": "请把以下内容翻译成中文：\n"},
        {"icon": "💻", "label": "写代码", "prompt": "请用 Python 实现以下功能：\n"},
        {"icon": "🐛", "label": "解释代码", "prompt": "请解释以下代码的作用：\n"},
        {"icon": "✍️", "label": "润色", "prompt": "请润色以下文字，让表达更流畅：\n"},
        {"icon": "❓", "label": "列要点", "prompt": "请把以下内容整理成要点：\n"},
    ],
    # v6.3.0 新增
    "style_profile": {
        "tone": "casual",
        "length": "medium",
        "emoji": True,
        "custom_rules": [],
    },
    "glossary": [],
    "writing_personas": {
        "coding": "你现在是一位资深工程师，回答严谨、简洁，给出可执行代码。",
        "copywriting": "你现在是一位文案高手，语言活泼、有感染力，善用短句和比喻。",
        "official": "你现在是一位商务助理，措辞正式、得体，避免口语和俚语。",
    },
    # v6.3.0 新增
    "style_profile": {
        "tone": "casual",
        "length": "medium",
        "emoji": True,
        "custom_rules": [],
    },
    "glossary": [],
    "writing_personas": {
        "coding": "你现在是一位资深工程师，回答严谨、简洁，给出可执行代码。",
        "copywriting": "你现在是一位文案高手，语言活泼、有感染力，善用短句和比喻。",
        "official": "你现在是一位商务助理，措辞正式、得体，避免口语和俚语。",
    },
}

# ================== 用户路径工具 ==================
def user_dir(username):
    return os.path.join(USERS_DIR, username)

def user_settings_file(username):
    return os.path.join(user_dir(username), "settings.json")

def user_sessions_dir(username):
    return os.path.join(user_dir(username), "sessions")

def user_index_file(username):
    return os.path.join(user_sessions_dir(username), "index.json")


def migrate_old_data():
    # 1. 强制确保所有基础目录存在
    os.makedirs(USERS_DIR, exist_ok=True)
    os.makedirs(user_dir(DEFAULT_USER), exist_ok=True)
    os.makedirs(user_sessions_dir(DEFAULT_USER), exist_ok=True)

    # 2. 兜底检查 settings.json 是否存在
    settings_file = os.path.join(user_dir(DEFAULT_USER), "settings.json")
    if not os.path.exists(settings_file):
        default_settings = {
            "username": DEFAULT_USER,
            "persona": "你是一个乐于助人的AI助手。",
            "theme": "dark",
            "auto_read": False
        }
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(default_settings, f, ensure_ascii=False, indent=2)

migrate_old_data()

# ================== 用户管理 ==================
current_user = DEFAULT_USER      # 当前数据访问目标（可能是被别人旁观）
real_user = DEFAULT_USER         # 真实登录身份（v6.01）

def is_admin():
    return real_user == DEFAULT_USER

def is_spectator():
    """管理员切换到其他用户时为 True（只读旁观）"""
    return real_user == DEFAULT_USER and current_user != DEFAULT_USER

def guard_spectator():
    """写操作入口调用；旁观时返回 403"""
    if is_spectator():
        return jsonify({"error": "旁观模式只读，不能修改"}), 403
    return None

def list_all_users():
    if not os.path.exists(USERS_DIR):
        return [DEFAULT_USER]
    users = []
    for name in os.listdir(USERS_DIR):
        if os.path.isdir(user_dir(name)):
            users.append(name)
    if DEFAULT_USER not in users:
        users.insert(0, DEFAULT_USER)
    return sorted(users, key=lambda x: (x != DEFAULT_USER, x))

def create_user_dir(username):
    os.makedirs(user_sessions_dir(username), exist_ok=True)
    with open(user_settings_file(username), "w", encoding="utf-8") as f:
        json.dump(DEFAULT_SETTINGS, f, ensure_ascii=False, indent=2)
    with open(user_index_file(username), "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

if not os.path.exists(user_dir(DEFAULT_USER)):
    create_user_dir(DEFAULT_USER)

# ================== 设置读写 ==================
def load_settings(username=None):
    if username is None:
        username = current_user
    path = user_settings_file(username)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k, v in DEFAULT_SETTINGS.items():
                data.setdefault(k, v)
            return data
        except Exception as e:
            print(f"⚠️ 读取 {username} 设置失败：{e}")
    return DEFAULT_SETTINGS.copy()

def save_settings(username=None):
    if username is None:
        username = current_user
    try:
        os.makedirs(user_dir(username), exist_ok=True)
        with open(user_settings_file(username), "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ 保存 {username} 设置失败：{e}")

settings = load_settings(current_user)

# ================== 自动备份 ==================
def auto_backup():
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, f"backup_{timestamp}.zip")

        with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
            targets = ["server.py", "rag.py", "settings.json", "users", "templates", "static", "docs"]
            for t in targets:
                if os.path.isfile(t):
                    zf.write(t)
                elif os.path.isdir(t):
                    for root, _, files in os.walk(t):
                        for f in files:
                            full = os.path.join(root, f)
                            zf.write(full, full)

        size_mb = os.path.getsize(backup_path) / 1024 / 1024
        backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith("backup_") and f.endswith(".zip")])
        while len(backups) > BACKUP_KEEP:
            old = os.path.join(BACKUP_DIR, backups.pop(0))
            os.remove(old)
    except Exception as e:
        print(f"⚠️ 备份失败：{e}")

# 1. 优先找用户文档目录下的 MarioMakeChat/models
user_model_dir = os.path.expanduser("~/Documents/MarioMakeChat/master")

if os.path.exists(user_model_dir):
    BASE = user_model_dir
else:
    # 2. 如果用户没建，按原来逻辑找
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        if ".app/Contents/MacOS" in exe_dir:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(exe_dir)))
        else:
            base_dir = exe_dir
        BASE = os.path.join(base_dir, "master")
    else:
        BASE = os.path.join(os.path.dirname(__file__), "master")

import os
import sys
import threading
import time
import requests  # 确保顶部有导入

# 1. 定义模型存放路径（沿用你选定的 Documents 目录）
USER_DIR = os.path.expanduser("~/Documents/MarioMakeChat")
BASE = os.path.join(USER_DIR, "master")
os.makedirs(BASE, exist_ok=True)  # 确保目录存在

# 2. 设定默认下载的模型（以 1.5B 为例，文件小且快，你也可以换成 3B）
DEFAULT_MODEL_NAME = "qwen2.5-1.5b-instruct-q4_k_m.gguf"
DEFAULT_MODEL_URL = "https://modelscope.cn/models/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/master/qwen2.5-1.5b-instruct-q4_k_m.gguf"

# 全局变量记录下载进度，供前端读取
download_status = {
    "is_downloading": False,
    "progress": 0,
    "total": 0,
    "finished": False,
    "error": ""
}


def download_model_background():
    global download_status
    file_path = os.path.join(BASE, DEFAULT_MODEL_NAME)

    if os.path.exists(file_path):
        download_status["finished"] = True
        return

    download_status["is_downloading"] = True
    try:
        # 使用 stream 模式下载，边下边存
        response = requests.get(DEFAULT_MODEL_URL, stream=True, timeout=30)
        response.raise_for_status()
        total_size = int(response.headers.get('content-length', 0))
        download_status["total"] = total_size

        temp_path = file_path + ".tmp"
        with open(temp_path, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=1024 * 1024):  # 1MB chunk
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    download_status["progress"] = downloaded

        os.rename(temp_path, file_path)
        download_status["finished"] = True
    except Exception as e:
        download_status["error"] = str(e)
    finally:
        download_status["is_downloading"] = False

AVAILABLE_MODELS = {
    "1.5B Q4_K_M": f"{BASE}/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    "1.5B Q2_K": f"{BASE}/qwen2.5-1.5b-instruct-q2_k.gguf",
    "3B Q4_K_M": f"{BASE}/qwen2.5-3b-instruct-q4_k_m.gguf",
    "Qwen3-1.7B 🧠思考": "ollama:qwen3:1.7b",
}
DEFAULT_MODEL = "3B Q4_K_M"
# ================== 模型懒加载 ==================
llm = None
current_model_name = None
model_lock = threading.Lock()
LLM_LOCK = threading.Lock()     # ← 新增：防止并发抢 llm
TEMP_SESSIONS = {}
TEMP_LOCK = threading.Lock()

def load_model(name):
    global llm, current_model_name
    if name not in AVAILABLE_MODELS:
        if AVAILABLE_MODELS.get(name, "").startswith("ollama:"):
            return None  # Ollama 模型不走这里
        raise ValueError(f"未知模型：{name}")

    if current_model_name == name and llm is not None:
        return llm
    with model_lock:
        if current_model_name == name and llm is not None:
            return llm
        print(f"🚀 正在加载...")
        if llm is not None:
            del llm
            llm = None
            gc.collect()
        path = AVAILABLE_MODELS[name]
        if not os.path.exists(path):
            raise FileNotFoundError(f"模型文件不存在：{path}")
        llm = Llama(
            model_path=path,
            n_ctx=CTX_SIZE,
            n_threads=THREADS,
            n_gpu_layers=0,
            verbose=False,
            use_mmap=True
        )
        current_model_name = name
    return llm

start_model = settings.get("current_model") or DEFAULT_MODEL
if start_model not in AVAILABLE_MODELS:
    start_model = DEFAULT_MODEL

# v8.0.0: Ollama 模型不需要预加载
_start_path = AVAILABLE_MODELS.get(start_model, "")
if _start_path.startswith("ollama:"):
    print(f"ℹ️ 当前模型 {start_model} 走 Ollama，跳过本地预加载")
else:
    try:
        load_model(start_model)
    except Exception as e:
        print(f"⚠️ 模型加载失败：{e}")

auto_backup()
rag.load_docs()

app = Flask(__name__)
app.secret_key = "mmai-local-secret-key-v5"
app.permanent_session_lifetime = datetime.timedelta(days=7)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

# ================== 同步用户 session ==================
@app.before_request
def sync_user_from_session():
    global current_user, real_user, settings
    if request.path.startswith('/static/'):
        return
    real = session.get('current_user', DEFAULT_USER)
    view = session.get('viewing_user', real)
    # 非管理员强制只能看自己
    if real != DEFAULT_USER:
        view = real
    # 被查看用户不存在则回退
    if not os.path.isdir(user_dir(view)):
        view = real
    if real != real_user or view != current_user or not settings:
        real_user = real
        current_user = view
        settings = load_settings(view)

# ================== 访问密码 ==================
@app.before_request
def check_auth():
    if not ACCESS_PASSWORD:
        return
    # v6.1.3: 本机请求免登录（给 quick.py 用）
    if request.remote_addr in ("127.0.0.1", "::1", "localhost"):
        return
    if request.path in ["/login", "/favicon.ico"]:
        return
    if request.path.startswith("/static/"):
        return
    if not session.get("auth"):
        # API 类请求返回 JSON 错误，不重定向
        if request.path.startswith("/v1/") or request.path.startswith("/search"):
            return jsonify({"error": "Unauthorized"}), 401
        return redirect("/login")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    pwd = request.form.get("password", "")
    if pwd == ACCESS_PASSWORD:
        session["auth"] = True
        session.permanent = True
        return redirect("/")
    return render_template("login.html", error="密码错误")

@app.route("/logout")
def logout():
    session.pop("auth", None)
    return redirect("/login")

@app.route('/api/download_status', methods=['GET'])
def get_download_status():
    # 直接告诉前端：模型已经存在啦，不用下载了！
    return jsonify({
        "is_downloading": False,
        "progress": 100,
        "total": 100,
        "finished": True,
        "error": ""
    })

@app.route('/api/start_download', methods=['POST'])
def start_download():
    # 这个接口前端如果调用，也直接返回成功
    return jsonify({"status": "already_downloaded"})

# ================== 会话管理 ==================
def load_index(username=None):
    if username is None:
        username = current_user
    path = user_index_file(username)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            index = json.load(f)
        def sort_key(s):
            try:
                return (not s.get("pinned", False), -int(s["id"]))
            except Exception:
                return (not s.get("pinned", False), 0)
        index.sort(key=sort_key)
        return index
    except Exception:
        return []

def save_index(index, username=None):
    if username is None:
        username = current_user
    os.makedirs(user_sessions_dir(username), exist_ok=True)
    with open(user_index_file(username), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

def create_session(name="新对话", username=None):
    if username is None:
        username = current_user
    sid = str(int(time.time() * 1000))
    index = load_index(username)
    index.insert(0, {"id": sid, "name": name, "time": time.strftime("%Y-%m-%d %H:%M"), "pinned": False})
    save_index(index, username)
    save_session(sid, [], username)
    return sid

def load_session(sid, username=None):
    if username is None:
        username = current_user
    path = os.path.join(user_sessions_dir(username), f"{sid}.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_session(sid, history, username=None):
    if username is None:
        username = current_user
    os.makedirs(user_sessions_dir(username), exist_ok=True)
    path = os.path.join(user_sessions_dir(username), f"{sid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def delete_session(sid, username=None):
    if username is None:
        username = current_user
    path = os.path.join(user_sessions_dir(username), f"{sid}.json")
    if os.path.exists(path):
        os.remove(path)
    index = load_index(username)
    index = [s for s in index if s["id"] != sid]
    save_index(index, username)

def rename_session(sid, name, username=None):
    if username is None:
        username = current_user
    index = load_index(username)
    for s in index:
        if s["id"] == sid:
            s["name"] = name
            break
    save_index(index, username)

current_session_id = None

def get_history():
    global current_session_id
    if not current_session_id:
        current_session_id = create_session()
    return load_session(current_session_id)

def set_history(h):
    global current_session_id
    if current_session_id:
        save_session(current_session_id, h)

def auto_name_session(sid, first_msg):
    name = first_msg.strip()[:20] or "新对话"
    rename_session(sid, name)

# ================== 工具函数 ==================
def clean_surrogates(s):
    return ''.join(c for c in s if not (0xD800 <= ord(c) <= 0xDFFF))

SLANG_MAP = {
    "尼豪": "你好", "泥豪": "你好", "尼嚎": "你好",
    "rushe": "Rush E", "rushi": "Rush E",
    "无线跳跃": "无限跳跃", "无线生命": "无限生命", "无线时间": "无限时间",
}

def normalize_input(text):
    for k, v in SLANG_MAP.items():
        text = text.replace(k, v)
    return text

KEYWORD_REPLIES = [
    (["Rush E", "rushe", "Rush E区别"],
     "Rush E 是 Sheet Music Boss 创作的系列钢琴曲（MIDI 音乐），以'人类不可能演奏'为梗。原版约2分19秒、48840音符；Rush E 2、3、4 是续作，长度和复杂度依次递增。"),
    (["你是谁", "你叫什么", "你的名字"], "我是墨墨，是你亲手造出来的本地 AI 助手。"),
    (["你会什么", "你能做什么", "你的功能"], "我会聊天、联网搜索、RAG 知识库、记住我们的对话，还能用简体中文回答。"),
    (["再见", "拜拜"], "再见！随时回来找我。"),
    (["谢谢", "感谢"], "不客气！"),
]

CHEAT_KEYWORDS = [
    "作弊码", "金手指", "Game Genie",
    "无限跳跃", "无限生命", "空中游泳", "超高跳跃",
    "无敌", "免疫", "火球", "起始生命", "管道", "穿墙",
    "关卡选择", "无限时间", "夜间模式", "游戏加速",
]

CONFIG_KEYS = [
    "CTX_SIZE", "THREADS", "MAX_TOKENS", "TEMPERATURE",
    "TOP_P", "SEARCH_RESULTS", "MAX_FILE_TEXT",
    "Context window", "上下文窗口", "上下文",
    "线程数", "最大生成长度", "随机性", "核采样",
]

def match_keyword(text):
    if any(kw in text for kw in CHEAT_KEYWORDS):
        if rag.has_index():
            results = rag.search(text)
            if results:
                keywords = [w for w in [
                    "无限跳跃", "无限生命", "无敌", "空中游泳", "超高跳跃",
                    "免疫", "火球", "起始生命", "管道", "时间", "关卡",
                    "穿墙", "空中", "跳跃", "生命", "金币"
                ] if w in text]
                if keywords:
                    lines = []
                    for r in results:
                        for line in r["text"].split("\n"):
                            if any(kw in line for kw in keywords):
                                lines.append(line.strip())
                    if lines:
                        return "\n".join(lines)
                return rag.format_context(results)

    if any(k in text for k in CONFIG_KEYS):
        # v6.0.3: 如果用户在问「是什么/含义/解释/作用」，跳过关键词捷径，走 RAG + LLM
        EXPLAIN_TRIGGERS = ["是什么", "什么意思", "含义", "解释", "作用", "用途", "干啥", "做什么", "代表什么",
                            "表示什么", "怎么用", "如何理解"]
        if any(t in text for t in EXPLAIN_TRIGGERS):
            return None  # 返回 None，让流程继续走 RAG + LLM

        if rag.has_index():
            results = rag.search(text)
            if results:
                pattern = re.compile(
                    r'(CTX_SIZE|THREADS|MAX_TOKENS|TEMPERATURE|TOP_P|SEARCH_RESULTS|MAX_FILE_TEXT)\s*=\s*[\d\.]+'
                )
                lines = []
                for r in results:
                    for line in r["text"].split("\n"):
                        m = pattern.search(line)
                        if m:
                            lines.append(m.group(0).strip())
                if lines:
                    return "\n".join(sorted(set(lines)))

    for keywords, reply in KEYWORD_REPLIES:
        for kw in keywords:
            if kw in text:
                return reply
    return None

def save_ocr_to_kb(text, source_filename):
    """把 OCR 结果存进知识库"""
    try:
        os.makedirs("./docs", exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        # 从原文件名里取个简短标识
        base = os.path.splitext(source_filename)[0][:20]
        save_path = f"./docs/ocr_{base}_{timestamp}.md"

        content = f"# OCR 识别：{source_filename}\n\n> 识别时间：{time.strftime('%Y-%m-%d %H:%M')}\n\n{text}\n"
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"📝 OCR 结果已存入知识库：{save_path}")
    except Exception as e:
        print(f"⚠️ 存入知识库失败：{e}")


# ================== 文件解析 ==================
def extract_text_from_file(file_storage):
    filename = file_storage.filename.lower()
    data = file_storage.read()

    if filename.endswith(('.txt', '.md', '.py', '.js', '.json', '.html', '.css', '.xml', '.yaml', '.yml', '.java', '.c', '.cpp', '.go', '.rs')):
        return data.decode('utf-8', errors='ignore')

    if filename.endswith('.pdf'):
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    if filename.endswith('.docx'):
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)

    if filename.endswith('.pptx'):
        prs = Presentation(io.BytesIO(data))
        texts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    texts.append(shape.text)
        return "\n".join(texts)

    if filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
        try:
            text = ocr_image(data).strip()
            if text and len(text) >= 5:
                save_ocr_to_kb(text, filename)
            return text if text else "（图片中没有识别到文字）"
        except ImportError as e:
            print(f"⚠️ RapidOCR 未安装，fallback Tesseract: {e}")
            try:
                import pytesseract
                pytesseract.pytesseract.tesseract_cmd = "/usr/local/bin/tesseract"
                img = Image.open(io.BytesIO(data))
                text = pytesseract.image_to_string(img, lang='chi_sim+eng').strip()
                if text and len(text) >= 5:
                    save_ocr_to_kb(text, filename)
                return text if text else "（图片中没有识别到文字）"
            except Exception as e2:
                return f"（图片识别失败：{e2}）"
        except Exception as e:
            return f"（图片识别失败：{e}）"

    if filename.endswith(('.xlsx', '.xls', '.csv', '.numbers')):
        return "（暂不支持表格文件，请转换为文本或 PDF）"

    return "（不支持的文件格式）"


# ==================== v9.0.0 精确计算模块 (高精度版) ====================
import ast
import operator
import math
from decimal import Decimal, getcontext, InvalidOperation

# 设置高精度（50位小数，足以应付绝大多数场景，且不会卡顿）
getcontext().prec = 50

_SAFE_OPERATORS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
    ast.USub: operator.neg, ast.UAdd: operator.pos,
}

_SAFE_MATH = {
    'sqrt': lambda x: Decimal(x).sqrt(),  # Decimal 自带精确开方
    'abs': abs, 'round': round, 'pi': Decimal('3.1415926535897932384626433832795028841971'),
    'e': Decimal('2.7182818284590452353602874713526624977572')
}


def format_number(n):
    """格式化 Decimal 结果，去掉多余的尾随 0"""
    if isinstance(n, Decimal):
        # 如果是整数，去掉小数点
        if n == n.to_integral_value():
            return str(n.quantize(Decimal('1')))
        # 否则去掉尾部多余的 0
        return format(n.normalize(), 'f')
    return str(n)


def safe_calculate(expr):
    """基于 Decimal 的绝对精确计算"""
    try:
        # 预处理符号
        expr = expr.replace('×', '*').replace('÷', '/').replace('^', '**')

        def _eval(node):
            if isinstance(node, ast.Constant):
                if isinstance(node.value, (int, float)):
                    # 关键：把普通数字转成 Decimal，绝不能直接用 float
                    return Decimal(str(node.value))
                elif isinstance(node.value, str):
                    return Decimal(node.value)
            elif isinstance(node, ast.BinOp):
                left = _eval(node.left)
                right = _eval(node.right)
                op_type = type(node.op)
                if op_type not in _SAFE_OPERATORS:
                    raise ValueError("不支持的操作符")
                return _SAFE_OPERATORS[op_type](left, right)
            elif isinstance(node, ast.UnaryOp):
                return _SAFE_OPERATORS[type(node.op)](_eval(node.operand))
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in _SAFE_MATH:
                    args = [_eval(arg) for arg in node.args]
                    return _SAFE_MATH[node.func.id](*args)
                raise ValueError("不支持的函数")
            elif isinstance(node, ast.Name):
                if node.id in _SAFE_MATH:
                    return _SAFE_MATH[node.id]
                raise ValueError(f"未知变量: {node.id}")
            else:
                raise TypeError(f"不支持: {type(node).__name__}")

        # 解析表达式并计算
        tree = ast.parse(expr, mode='eval')
        result = _eval(tree.body)
        return format_number(result)
    except Exception as e:
        return None

def is_math_query(text):
    """判断是不是纯数学计算题"""
    # 如果包含大量文字（比如汉字超过5个），说明是应用题，交给 LLM 或上下文注入
    if len(re.findall(r'[\u4e00-\u9fa5]', text)) > 5:
        return False
    # 包含数字和运算符，且长度较短
    if re.search(r'[\d\+\-\*\/\(\)\^\%]', text) and len(text) < 50:
        return True
    return False

# ================== 工具路由 ==================
SEARCH_TRIGGERS = ["搜索", "查一下", "帮我查", "最新", "新闻", "天气", "2024", "2025", "2026"]
TIME_TRIGGERS = ["几点", "现在时间", "今天几号", "今天日期", "今天是"]

def route_tools(text):
    tools = []
    if any(kw in text for kw in TIME_TRIGGERS):
        tools.append("time")
    is_chitchat = any(w in text for w in ["你", "我", "咱们", "我们"])
    if not is_chitchat and any(kw in text for kw in SEARCH_TRIGGERS):
        tools.append("search")
    return tools

def tool_time():
    now = datetime.datetime.now()
    weekdays = ["一", "二", "三", "四", "五", "六", "日"]
    return f"现在是 {now.strftime('%Y年%m月%d日 %H:%M')}，星期{weekdays[now.weekday()]}"

def web_search(query):
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=SEARCH_RESULTS):
                title = r.get("title", "")
                body = r.get("body", "")[:SEARCH_SNIPPET_LEN]
                results.append(f"【{title}】{body}")
        return "\n".join(results) if results else "（未找到相关结果）"
    except Exception as e:
        return f"（搜索失败：{e}）"

# ================== Prompt 构建 ==================
def build_prompt(user_text, contexts=None, history_override=None, extra_system=None):
    sys_prompt = settings.get("system_prompt") or DEFAULT_PROMPT
    if extra_system:
        sys_prompt += "\n\n" + extra_system
    name = settings.get("user_name")
    if name:
        sys_prompt += f" 用户的名字是 {name}，请用这个名字称呼用户。"

    # v6.1.1: 情感感知注入
    emo_ctx = get_emotion_context(user_text)
    if emo_ctx:
        sys_prompt += f"\n\n{emo_ctx}"

    # v6.3.0: 个性化风格注入
    style_ctx = build_style_context()
    if style_ctx:
        sys_prompt += f"\n\n【写作风格】\n{style_ctx}"

    glossary_ctx = build_glossary_context()
    if glossary_ctx:
        sys_prompt += f"\n\n{glossary_ctx}"

    parts = [f"<|im_start|>system\n{sys_prompt}<|im_end|>"]
    history = history_override if history_override is not None else get_history()
    for msg in history:
        parts.append(f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>")

    if contexts:
        full_context = "\n\n".join(contexts)
        content = f"{full_context}\n\n{user_text}"
    else:
        content = user_text

    parts.append(f"<|im_start|>user\n{content}<|im_end|>")
    parts.append("<|im_start|>assistant\n")
    return "\n".join(parts)

def trim_history(history):
    max_chars = (CTX_SIZE - 800) * 1.5
    while len(str(history)) > max_chars and len(history) > 2:
        history.pop(0)
        if history:
            history.pop(0)
    return history

# ================== 流式生成 ==================
def generate_stream(text, model_name, force_web=False, has_file=False, is_temp=False, temp_id="", think_mode="auto"):
    global current_session_id

    # v6.1.1: 推送情绪状态给前端
    emo = detect_emotion(text)
    if emo:
        yield f"__EMOTION__:{emo}\n"

    # v8.0.0: Ollama 分支（先查值，再判断）
    _model_path = AVAILABLE_MODELS.get(model_name, "")
    if _model_path.startswith("ollama:"):
        ollama_model = _model_path[7:]
        yield from generate_stream_ollama(text, ollama_model, is_temp, temp_id, think_mode)
        return

    try:
        load_model(model_name)
    except Exception as e:
        import traceback
        traceback.print_exc()
        yield f"\n⚠️ 生成出错：{e}"
        return

    if is_temp:
        with TEMP_LOCK:
            history = list(TEMP_SESSIONS.get(temp_id, []))
    else:
        history = get_history()

    if len(history) == 0 and current_session_id:
        auto_name_session(current_session_id, text[:30])

    m = re.search(r'(?:我叫|我是|我的名字是)[\s:：]*([\u4e00-\u9fa5a-zA-Z]{2,6})', text)
    if m:
        candidate = m.group(1)
        if candidate not in ["AI", "ai", "机器人", "助手", "墨墨"]:
            settings["user_name"] = candidate
            save_settings()

    if not has_file:
        # v9.0.0: 纯计算题直接拦截
        if is_math_query(text):
            calc_result = safe_calculate(text)
            if calc_result is not None:
                reply = f"🧮 `{text}` 的计算结果是：**{calc_result}**"
                yield reply
                history.append({"role": "user", "content": text})
                history.append({"role": "assistant", "content": reply})
                if is_temp:
                    with TEMP_LOCK:
                        TEMP_SESSIONS[temp_id] = history
                else:
                    set_history(history)
                return

        keyword_reply = match_keyword(text)
        if keyword_reply:
            yield keyword_reply
            history.append({"role": "user", "content": text})
            history.append({"role": "assistant", "content": keyword_reply})
            if is_temp:
                with TEMP_LOCK:
                    TEMP_SESSIONS[temp_id] = history
            else:
                set_history(history)
            return

    tools = route_tools(text)
    if force_web and "search" not in tools:
        tools.append("search")
    if has_file and not force_web:
        tools = [t for t in tools if t != "search"]

    contexts = []
    if tools:
        yield f"🔧 自动调用：{'、'.join(tools)}\n\n"

    if "time" in tools:
        t = tool_time()
        if len(tools) == 1:
            yield f"🕐 {t}"
            history.append({"role": "user", "content": text})
            history.append({"role": "assistant", "content": t})
            if is_temp:
                with TEMP_LOCK:
                    TEMP_SESSIONS[temp_id] = history
            else:
                set_history(history)
            return
        else:
            contexts.append(f"【当前时间】{t}")
            yield f"🕐 {t}\n\n"

    if "search" in tools:
        yield "🌐 正在联网搜索...\n\n"
        result = web_search(text)
        contexts.append(f"【联网搜索结果】\n{result}")

    # 有文件时不走 RAG（避免干扰文件内容问答）
    if rag.has_index() and not has_file:
        # v6.0.3: 闲聊过滤，避免无效检索
        CHITCHAT = ["你好", "您好", "谢谢", "感谢", "再见", "拜拜",
                    "你是谁", "你叫什么", "在吗", "在么", "hi", "hello", "hey"]
        skip_rag = (len(text) < 6) or any(k.lower() in text.lower() for k in CHITCHAT)

        if not skip_rag:
            results = rag.search(text)
            if results:
                # v6.3.1: 如果最高分低于 0.5，且问题不是明显的知识库问题，跳过 RAG
                max_score = max(r.get("score", 0) for r in results)
                print(f"🔍 RAG 调试：问题='{text[:30]}' max_score={max_score:.3f} 命中={len(results)}个")
                KB_HINTS = ["配置", "参数", "怎么设置", "知识库", "文档", "CTX", "THREADS", "MMAI"]
                is_kb_question = any(k in text for k in KB_HINTS)

                if max_score < 0.6 and not is_kb_question:
                    # 相似度不够高，又不是知识库相关问题，跳过
                    pass
                else:
                    rag_ctx = rag.format_context(results)
                    sources = sorted(set(r.get("source", "未知") for r in results))
                    contexts.append(
                        f"【本地知识库】\n{rag_ctx}\n\n"
                        f"严格基于以上知识库内容回答..."
                    )
                    yield f"📚 从知识库检索到 {len(results)} 个片段：{', '.join(sources)}\n\n"

    # ==================== v9.0.0 精确计算上下文注入 (强制打印版) ====================
    # 直接匹配括号包围的完整算式，或连续的数字+运算符
    math_matches = re.findall(r'[\(（]?[\d\.]+(?:\s*[\+\-\*\/\^×÷]\s*[\(（]?[\d\.]+[\)）]?)+', text)
    print(f"🧪 调试：提取到的算式列表 = {math_matches}")

    for raw_expr in math_matches:
        # 清理中文符号
        clean_expr = raw_expr.replace('×', '*').replace('÷', '/').replace('（', '(').replace('）', ')')
        if len(clean_expr) >= 5:
            calc_result = safe_calculate(clean_expr)
            print(f"🧪 调试：尝试计算 {clean_expr} = {calc_result}")
            if calc_result is not None:
                contexts.append(
                    f"【系统精确计算】\n"
                    f"用户询问的算式中包含：`{clean_expr}`，经系统 Python 引擎高精度计算，正确结果为：{calc_result}。\n"
                    f"请在回答中直接使用该正确结果，不要自己重新计算。"
                )
                yield f"🧮 已触发精确计算拦截：`{clean_expr}` = **{calc_result}**\n\n"
    # ==============================================================================

    prompt = clean_surrogates(build_prompt(
        text,
        contexts if contexts else None,
        history_override=history,
    ))
    print(f"🔍 调试：contexts 数量={len(contexts)}")
    print(f"🔍 调试：准备 build_prompt...")
    full_reply = ""

    if not LLM_LOCK.acquire(timeout=300):
        yield "\n⚠️ 系统忙，请稍后再试"
        return
    try:
        mt = int(settings.get("max_tokens", MAX_TOKENS))
        temp = float(settings.get("temperature", TEMPERATURE))
        tp = float(settings.get("top_p", TOP_P))
        stream = llm(
            prompt,
            max_tokens=mt,
            temperature=temp,
            top_p=tp,
            repeat_penalty=1.15,
            frequency_penalty=0.3,
            presence_penalty=0.1,
            stop=["<|im_end|>", "<|im_start|>"],
            echo=False,
            stream=True
        )
        print(f"🔍 调试：llm 开始流式生成...")
        for chunk in stream:
            token = chunk["choices"][0]["text"]
            if not token:
                continue
            full_reply += token
            yield cc.convert(token) if OPENCC_AVAILABLE else token
    except Exception as e:
        import traceback
        traceback.print_exc()
        yield f"\n⚠️ 生成出错：{e}"
        return
    finally:
        try:
            LLM_LOCK.release()
        except:
            pass

    final_reply = cc.convert(full_reply) if OPENCC_AVAILABLE else full_reply
    # 剥离 thinking 后再存历史
    final_reply_clean = re.sub(r'<thinking>[\s\S]*?</thinking>', '', final_reply).strip()
    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": final_reply_clean})
    history = trim_history(history)
    if is_temp:
        with TEMP_LOCK:
            TEMP_SESSIONS[temp_id] = history
    else:
        set_history(history)

def generate_stream_ollama(text, ollama_model, is_temp=False, temp_id="", think_mode="auto"):
    ...
    SIMPLE_PATTERNS = ['你好', '您好', 'hi', 'hello', 'hey', '在吗', '在么',
                       '谢谢', '感谢', '再见', '拜拜', '晚安', '早安',
                       '几点', '日期', '星期', '记一下', '待办']
    _text_lower = text.lower().strip()

    if think_mode == 'on':
        use_think = True
    elif think_mode == 'off':
        use_think = False
    else:  # auto
        use_think = not any(p in _text_lower for p in SIMPLE_PATTERNS)
        if len(_text_lower) < 5:
            use_think = False

    # 读历史
    if is_temp:
        with TEMP_LOCK:
            history = list(TEMP_SESSIONS.get(temp_id, []))
    else:
        history = get_history()

    # 组装 messages
    sys_prompt = settings.get("system_prompt") or DEFAULT_PROMPT
    name = settings.get("user_name")
    if name:
        sys_prompt += f" 用户的名字是 {name}，请用这个名字称呼用户。"

    messages = [{"role": "system", "content": sys_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": text})

    # 调 Ollama
    try:
        resp = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json={
                "model": ollama_model,
                "messages": messages,
                "stream": True,
                "think": use_think,
            },
            stream=True,
            timeout=300
        )
        resp.raise_for_status()
    except Exception as e:
        yield f"\n⚠️ Ollama 连接失败：{e}\n（确认 Ollama 在运行）"
        return

    full_reply = ""
    full_thinking = ""
    in_thinking = False

    try:
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                chunk = json.loads(line)
            except:
                continue

            msg = chunk.get("message", {})
            thinking = msg.get("thinking", "")
            content = msg.get("content", "")

            if thinking:
                if not in_thinking:
                    yield "<thinking>"
                    in_thinking = True
                full_thinking += thinking
                yield thinking

            if content:
                if in_thinking:
                    yield "</thinking>"
                    in_thinking = False
                full_reply += content
                yield content

            if chunk.get("done"):
                break
    except Exception as e:
        yield f"\n⚠️ 流式生成出错：{e}"

    # 收尾：thinking 没关闭就补上
    if in_thinking:
        yield "</thinking>"

    # 保存历史（不含 thinking）
    final_reply = full_reply.strip()
    if final_reply:
        history.append({"role": "user", "content": text})
        history.append({"role": "assistant", "content": final_reply})
        history = trim_history(history)
        if is_temp:
            with TEMP_LOCK:
                TEMP_SESSIONS[temp_id] = history
        else:
            set_history(history)

# ================== 用户路由 ==================
@app.route("/users", methods=["GET"])
def list_users():
    if is_admin():
        return jsonify({
            "users": list_all_users(),
            "current": current_user,
            "login": real_user,
            "is_admin": True,
            "spectator": is_spectator()
        })
    return jsonify({
        "users": [real_user],
        "current": real_user,
        "login": real_user,
        "is_admin": False,
        "spectator": False
    })

@app.route("/users/switch", methods=["POST"])
def switch_user():
    global current_user, settings, current_session_id
    if not is_admin():
        return jsonify({"error": "只有 default 用户能切换"}), 403
    data = request.json or {}
    name = data.get("user")
    if not os.path.isdir(user_dir(name)):
        return jsonify({"error": "用户不存在"}), 400
    session["viewing_user"] = name
    session.permanent = True
    current_user = name
    settings = load_settings(name)
    current_session_id = None
    return jsonify({
        "ok": True,
        "user": name,
        "spectator": name != real_user
    })

@app.route("/users/switch_to_default", methods=["POST"])
def switch_to_default():
    """快捷键用：强制切回 default 管理员身份"""
    global current_user, settings, current_session_id
    session["current_user"] = DEFAULT_USER
    session.pop("viewing_user", None)
    session.permanent = True
    current_user = DEFAULT_USER
    settings = load_settings(DEFAULT_USER)
    current_session_id = None
    return jsonify({"ok": True})

@app.route("/users/exit_view", methods=["POST"])
def exit_view():
    """退出旁观，回到 default 自己"""
    global current_user, settings, current_session_id
    if not is_admin():
        return jsonify({"error": "无权限"}), 403
    session.pop("viewing_user", None)
    current_user = real_user
    settings = load_settings(real_user)
    current_session_id = None
    return jsonify({"ok": True})

@app.route("/users/new", methods=["POST"])
def new_user():
    if not is_admin():
        return jsonify({"error": "无权限"}), 403
    data = request.json or {}
    name = data.get("user", "").strip()
    if not name or not re.match(r'^[\w\u4e00-\u9fa5\-]{1,20}$', name):
        return jsonify({"error": "名字不合法（1-20 位字母/数字/汉字/下划线/短横线）"}), 400
    if os.path.exists(user_dir(name)):
        return jsonify({"error": "用户已存在"}), 400
    try:
        create_user_dir(name)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/users/delete", methods=["POST"])
def delete_user():
    global current_user, settings, current_session_id
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    name = data.get("user")
    if name == DEFAULT_USER:
        return jsonify({"error": "不能删除 default 用户"}), 400
    # v6.01: 只能删自己
    if name != real_user:
        return jsonify({"error": "只能删除自己的用户"}), 403
    if not os.path.isdir(user_dir(name)):
        return jsonify({"error": "用户不存在"}), 400
    try:
        shutil.rmtree(user_dir(name))
        # 如果删的是自己，自动切回 default
        if name == current_user:
            current_user = DEFAULT_USER
            settings = load_settings(DEFAULT_USER)
            current_session_id = None
            session["current_user"] = DEFAULT_USER
        return jsonify({"ok": True, "switched": name == current_user})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/users/rename", methods=["POST"])
def rename_user():
    global current_user, settings
    guard = guard_spectator()
    if guard: return guard
    if not is_admin() and (request.json or {}).get("old") != real_user:
        return jsonify({"error": "无权限"}), 403
    data = request.json or {}
    old = data.get("old")
    new = data.get("new", "").strip()
    if old == DEFAULT_USER:
        return jsonify({"error": "不能重命名 default 用户"}), 400
    if not new or not re.match(r'^[\w\u4e00-\u9fa5\-]{1,20}$', new):
        return jsonify({"error": "名字不合法"}), 400
    if os.path.exists(user_dir(new)):
        return jsonify({"error": "名字已存在"}), 400
    if not os.path.isdir(user_dir(old)):
        return jsonify({"error": "用户不存在"}), 400
    try:
        os.rename(user_dir(old), user_dir(new))
        if current_user == old:
            current_user = new
            settings = load_settings(new)
            session["current_user"] = new
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ================== 主路由 ==================
@app.route("/")
def index():
    return render_template("index.html")

import psutil, os, time
START_TIME = time.time()

@app.route('/api/status')
def api_status():
    proc = psutil.Process(os.getpid())
    vm = psutil.virtual_memory()
    return jsonify({
        'cpu_percent': psutil.cpu_percent(interval=0.1),
        'mem_percent': vm.percent,
        'mem_used_gb': round((vm.total - vm.available) / 1024**3, 2),
        'mem_total_gb': round(vm.total / 1024**3, 2),
        'proc_mem_mb': round(proc.memory_info().rss / 1024**2, 1),
        'model': settings.get("current_model", DEFAULT_MODEL),
        'uptime_s': int(time.time() - START_TIME),
    })

# 2. 翻译
@app.route('/api/translate', methods=['POST'])
def api_translate():
    text = request.get_json().get('text', '').strip()
    if not text:
        return jsonify({'result': ''})

    has_chinese = any('\u4e00' <= ch <= '\u9fff' for ch in text)
    if has_chinese:
        target = "英文"
        rule = "Output ONLY the English translation."
    else:
        target = "中文"
        rule = "只输出中文译文。"

    model_name = settings.get("current_model") or DEFAULT_MODEL
    if model_name not in AVAILABLE_MODELS:
        model_name = DEFAULT_MODEL
    try:
        load_model(model_name)
    except Exception as e:
        return jsonify({'result': f'模型加载失败：{e}'}), 500

    prompt = (
        "<|im_start|>system\n"
        f"You are a translation engine. Translate the user's text into {target}. "
        f"{rule}\n"
        "<|im_end|>\n"
        "<|im_start|>user\n"
        f"{text}\n"
        "<|im_end|>\n"
        "<|im_start|>assistant\n"
    )

    # 尝试拿锁，拿不到说明有对话在跑，直接提示
    if not LLM_LOCK.acquire(timeout=0.5):
        return jsonify({'result': '⏳ 模型正忙（有对话进行中），请稍后再试'})
    try:
        output = llm(
            prompt,
            max_tokens=400,
            temperature=0.2,
            top_p=0.9,
            repeat_penalty=1.1,
            stop=["<|im_end|>", "<|im_start|>"],
            echo=False
        )
        reply = output["choices"][0]["text"].strip()
        if OPENCC_AVAILABLE:
            reply = cc.convert(reply)
    except Exception as e:
        reply = f'翻译失败：{e}'
    finally:
        LLM_LOCK.release()

    return jsonify({'result': reply})

# ==================== v8.7.0 生图提示词翻译 ====================
@app.route('/api/translate_prompt', methods=['POST'])
def translate_prompt():
    text = (request.json or {}).get('text', '').strip()
    if not text:
        return jsonify({'en': ''})
    model_name = settings.get("current_model") or DEFAULT_MODEL
    try:
        load_model(model_name)
    except Exception as e:
        return jsonify({'en': text})  # 失败就原样返回

    prompt = (
        "<|im_start|>system\n"
        "Translate the user's Chinese description into a concise English image-generation prompt. "
        "Preserve gender (boy/girl/man/woman), age (toddler/child/teen), action, and scene accurately. "
        "CRITICAL: When the subject is male (boy/man), ALWAYS add 'short hair, masculine features, male' to the output. "
        "When the subject is female, ALWAYS add 'female, feminine features'. "
        "Output ONLY the English prompt — no quotes, no explanation, no Chinese.\n"
        "Keep gender/age/action/scene accurate. Output ONLY the English prompt, no explanation, no quotes.\n"
        "Example: 3岁小男孩在草地上奔跑，阳光明媚 → 3-year-old boy running on a grassy field, bright sunny day\n"
        "<|im_end|>\n"
        "<|im_start|>user\n"
        f"{text}\n"
        "<|im_end|>\n"
        "<|im_start|>assistant\n"
    )
    LLM_LOCK.acquire()
    try:
        out = llm(prompt, max_tokens=100, temperature=0.1, top_p=0.9,
                  stop=["<|im_end|>"], echo=False)
        en = out["choices"][0]["text"].strip()
    finally:
        LLM_LOCK.release()
    return jsonify({'en': en})

# ==================== v8.6.0 本地语音识别 ====================
_whisper_model = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        print('🎙️ 正在加载 whisper 模型…')
        _whisper_model = WhisperModel('small', device='cpu', compute_type='int8')
        print('✅ whisper 模型加载完成')
    return _whisper_model

@app.route('/api/transcribe', methods=['POST'])
def api_transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': '没有音频'}), 400
    audio = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as f:
        audio.save(f.name)
        webm_path = f.name
    wav_path = webm_path + '.wav'
    try:
        # 用 ffmpeg 转成 16kHz 单声道 WAV（faster-whisper 读不了浏览器 webm）
        r = subprocess.run(
            ['ffmpeg', '-y', '-i', webm_path,
             '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
             wav_path],
            capture_output=True, text=True, timeout=30
        )
        if r.returncode != 0:
            print('ffmpeg 错误:', r.stderr[-500:])
            return jsonify({'error': '音频转码失败'}), 500

        m = get_whisper()
        segs, _ = m.transcribe(wav_path, language='zh', vad_filter=True)
        text = ''.join(s.text for s in segs).strip()
        return jsonify({'text': text})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        for pp in (webm_path, wav_path):
            try: os.remove(pp)
            except: pass

# 3. 待办
@app.route('/api/todo', methods=['GET', 'POST'])
def api_todo():
    TODO_FILE = os.path.join(os.path.dirname(__file__), 'docs', 'todo.md')
    os.makedirs(os.path.dirname(TODO_FILE), exist_ok=True)
    if request.method == 'POST':
        item = request.get_json().get('item', '').strip()
        if not item: return jsonify({'ok': False}), 400
        ts = time.strftime('%Y-%m-%d %H:%M')
        with open(TODO_FILE, 'a', encoding='utf-8') as f:
            f.write(f"- [ ] {item}  _({ts})_\n")
        return jsonify({'ok': True})
    if not os.path.exists(TODO_FILE): return jsonify({'items': []})
    with open(TODO_FILE, encoding='utf-8') as f:
        return jsonify({'items': f.read().splitlines()})

# ==================== v8.2.0 头像上传 ====================
@app.route('/api/avatar', methods=['POST'])
def api_avatar():
    guard = guard_spectator()
    if guard: return guard

    file = request.files.get('avatar')
    if not file or not file.filename:
        return jsonify({'ok': False, 'error': '没收到文件'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ('png', 'jpg', 'jpeg', 'webp', 'gif'):
        return jsonify({'ok': False, 'error': '只支持图片'}), 400

    save_path = os.path.join(os.path.dirname(__file__), 'static', 'avatar.png')
    try:
        # 用 PIL 统一转成 PNG
        from PIL import Image
        img = Image.open(file.stream)
        img = img.convert('RGBA')
        # 裁成正方形
        w, h = img.size
        s = min(w, h)
        img = img.crop(((w-s)//2, (h-s)//2, (w+s)//2, (h+s)//2))
        img = img.resize((128, 128), Image.LANCZOS)
        img.save(save_path, 'PNG')
    except Exception as e:
        return jsonify({'ok': False, 'error': f'处理失败：{e}'}), 500

    return jsonify({'ok': True})

# ==================== v7.1.0 文件夹 ====================
@app.route('/api/folders')
def api_folders():
    folders = settings.get("folders", [])
    return jsonify({"folders": folders})

@app.route('/api/folders/new', methods=['POST'])
def api_folders_new():
    guard = guard_spectator()
    if guard: return guard
    name = (request.get_json() or {}).get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "名字不能为空"}), 400
    folders = settings.get("folders", [])
    fid = "f_" + str(int(time.time() * 1000))
    folders.append({"id": fid, "name": name[:30], "sessions": []})
    settings["folders"] = folders
    save_settings()
    return jsonify({"ok": True, "id": fid})

@app.route('/api/folders/<fid>/rename', methods=['POST'])
def api_folders_rename(fid):
    guard = guard_spectator()
    if guard: return guard
    name = (request.get_json() or {}).get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "名字不能为空"}), 400
    folders = settings.get("folders", [])
    for f in folders:
        if f["id"] == fid:
            f["name"] = name[:30]
            settings["folders"] = folders
            save_settings()
            return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "文件夹不存在"}), 404

@app.route('/api/folders/<fid>/delete', methods=['POST'])
def api_folders_delete(fid):
    guard = guard_spectator()
    if guard: return guard
    folders = settings.get("folders", [])
    settings["folders"] = [f for f in folders if f["id"] != fid]
    save_settings()
    return jsonify({"ok": True})

@app.route('/api/folders/move', methods=['POST'])
def api_folders_move():
    guard = guard_spectator()
    if guard: return guard
    data = request.get_json() or {}
    sid = data.get("sid")
    fid = data.get("fid")  # None 表示移出文件夹
    if not sid:
        return jsonify({"ok": False, "error": "缺 sid"}), 400
    folders = settings.get("folders", [])
    # 先从所有文件夹里移走
    for f in folders:
        if sid in f.get("sessions", []):
            f["sessions"].remove(sid)
    # 再加进目标文件夹
    if fid:
        for f in folders:
            if f["id"] == fid:
                f.setdefault("sessions", []).append(sid)
                break
    settings["folders"] = folders
    save_settings()
    return jsonify({"ok": True})

@app.route("/reload", methods=["POST"])
def reload_all():
    """软重载：重新读 settings / 重载 RAG / 重载模型"""
    global settings, llm, current_model_name
    guard = guard_spectator()
    if guard: return guard

    # 1. 重读 settings
    settings = load_settings(current_user)

    # 2. 重载 RAG
    rag.reload()

    # 3. 重载模型
    try:
        current_name = settings.get("current_model") or DEFAULT_MODEL
        current_model_name = None  # 强制重载
        load_model(current_name)
    except Exception as e:
        return jsonify({"ok": False, "error": f"模型重载失败：{e}"}), 500

    return jsonify({"ok": True, "message": "已重载设置 / 知识库 / 模型"})

@app.route("/api/reset_factory", methods=["POST"])
def reset_factory():
    guard = guard_spectator()
    if guard: return guard
    try:
        if os.path.exists(USERS_DIR):
            shutil.rmtree(USERS_DIR) # 连根拔起，删除 users 目录
        migrate_old_data() # 瞬间重建
        return jsonify({"status": "success", "message": "已恢复出厂设置，default 用户已重建"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/models")
def list_models():
    return jsonify({"available": list(AVAILABLE_MODELS.keys()), "current": current_model_name or DEFAULT_MODEL})

@app.route("/set_model", methods=["POST"])
def set_model():
    guard = guard_spectator()
    if guard: return guard
    data = request.json
    name = data.get("model")
    if name not in AVAILABLE_MODELS:
        return jsonify({"error": "未知模型"}), 400
    settings["current_model"] = name
    save_settings()
    return jsonify({"ok": True})

@app.route("/templates", methods=["GET"])
def get_templates():
    return jsonify(settings.get("templates", []))

@app.route("/templates", methods=["POST"])
def set_templates():
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    settings["templates"] = data.get("templates", [])
    save_settings()
    return jsonify({"ok": True})

@app.route("/settings", methods=["GET"])
def get_settings():
    return jsonify(settings)

@app.route("/settings", methods=["POST"])
def update_settings():
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    for k in DEFAULT_SETTINGS:
        if k in data:
            settings[k] = data[k]
    save_settings()
    return jsonify({"ok": True})

@app.route("/set_prompt", methods=["POST"])
def set_prompt():
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "提示词不能为空"}), 400
    settings["system_prompt"] = prompt
    save_settings()
    return jsonify({"ok": True})

@app.route("/sessions", methods=["GET"])
def list_sessions():
    return jsonify(load_index())

@app.route("/sessions/clear", methods=["POST"])
def clear_sessions():
    global current_session_id
    guard = guard_spectator()
    if guard: return guard
    index = load_index()
    for s in index:
        if not s.get("pinned", False):
            path = os.path.join(user_sessions_dir(current_user), f"{s['id']}.json")
            if os.path.exists(path):
                os.remove(path)
    new_index = [s for s in index if s.get("pinned", False)]
    save_index(new_index)
    if current_session_id and not any(s["id"] == current_session_id for s in new_index):
        current_session_id = None
    return jsonify({"ok": True, "kept": len(new_index)})

@app.route("/sessions/new", methods=["POST"])
def new_session():
    global current_session_id
    guard = guard_spectator()
    if guard: return guard
    sid = create_session()
    current_session_id = sid
    settings["last_session"] = sid
    save_settings()
    return jsonify({"id": sid})

@app.route("/sessions/<sid>", methods=["GET"])
def get_session(sid):
    global current_session_id
    current_session_id = sid
    settings["last_session"] = sid
    save_settings()
    return jsonify(load_session(sid))

@app.route("/sessions/<sid>", methods=["DELETE"])
def del_session(sid):
    global current_session_id
    guard = guard_spectator()
    if guard: return guard
    delete_session(sid)
    if current_session_id == sid:
        current_session_id = None
    return jsonify({"ok": True})

@app.route("/sessions/<sid>/rename", methods=["POST"])
def rename_sess(sid):
    guard = guard_spectator()
    if guard: return guard
    data = request.json
    rename_session(sid, data.get("name", "未命名"))
    return jsonify({"ok": True})

@app.route("/sessions/<sid>/pin", methods=["POST"])
def pin_session(sid):
    guard = guard_spectator()
    if guard: return guard
    index = load_index()
    for s in index:
        if s["id"] == sid:
            s["pinned"] = not s.get("pinned", False)
            break
    save_index(index)
    return jsonify({"ok": True})

@app.route("/sessions/<sid>/truncate", methods=["POST"])
def truncate_session(sid):
    guard = guard_spectator()
    if guard: return guard
    """从某条消息开始，删掉之后的所有消息"""
    data = request.json or {}
    index = data.get("index", -1)
    if index < 0:
        return jsonify({"error": "无效索引"}), 400

    hist = load_session(sid)
    if index >= len(hist):
        return jsonify({"error": "索引超出范围"}), 400

    new_hist = hist[:index]
    save_session(sid, new_hist)
    return jsonify({"ok": True, "len": len(new_hist)})

@app.route("/sessions/<sid>/export", methods=["GET"])
def export_session(sid):
    hist = load_session(sid)
    if not hist:
        return Response("（空对话）", mimetype="text/plain; charset=utf-8")

    index = load_index()
    name = "对话"
    for s in index:
        if s["id"] == sid:
            name = s["name"]
            break

    lines = [f"# {name}\n", f"> 导出于 {time.strftime('%Y-%m-%d %H:%M')}\n"]
    for msg in hist:
        role = "🧑 我" if msg["role"] == "user" else "🐣 墨墨"
        lines.append(f"### {role}\n\n{msg['content']}\n")

    content = "\n".join(lines)
    from urllib.parse import quote
    filename_utf8 = quote(f"{name}.md", safe='')
    return Response(
        content,
        mimetype="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"chat_export.md\"; "
                f"filename*=UTF-8''{filename_utf8}"
            )
        }
    )

@app.route("/search", methods=["GET"])
def search_sessions():
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify([])

    # 直接遍历 sessions 文件夹，不依赖 index.json
    sessions_dir = user_sessions_dir(current_user)
    if not os.path.isdir(sessions_dir):
        return jsonify([])

    # 建立 id → name 映射
    name_map = {}
    for s in load_index():
        name_map[s["id"]] = s["name"]

    results = []
    for fname in os.listdir(sessions_dir):
        if not fname.endswith(".json") or fname == "index.json":
            continue
        sid = fname[:-5]  # 去掉 .json
        hist = load_session(sid)
        for i, msg in enumerate(hist):
            if q in msg["content"].lower():
                content = msg["content"]
                pos = content.lower().find(q)
                start = max(0, pos - 30)
                end = min(len(content), pos + len(q) + 40)
                snippet = content[start:end]
                if start > 0:
                    snippet = "..." + snippet
                if end < len(content):
                    snippet = snippet + "..."

                results.append({
                    "session_id": sid,
                    "session_name": name_map.get(sid, "对话"),
                    "role": msg["role"],
                    "snippet": snippet,
                    "index": i
                })
                if len(results) >= 50:
                    return jsonify(results)

    return jsonify(results)

@app.route("/rag/reload", methods=["POST"])
def rag_reload():
    rag.reload()
    return jsonify({"ok": True, "chunks": len(rag._chunks)})

@app.route("/rag/status", methods=["GET"])
def rag_status():
    guard = guard_spectator()
    if guard: return guard
    return jsonify({"chunks": len(rag._chunks), "files": len(set(c["source"] for c in rag._chunks))})

@app.route("/forget_name", methods=["POST"])
def forget_name():
    guard = guard_spectator()
    if guard: return guard
    settings["user_name"] = None
    save_settings()
    return jsonify({"ok": True})

@app.route("/chat", methods=["POST"])
def chat():
    file_text = ""
    has_file = False
    guard = guard_spectator()
    if guard: return guard

    if request.content_type and 'multipart/form-data' in request.content_type:
        text = request.form.get('message', '').strip()
        model_name = request.form.get('model', DEFAULT_MODEL)
        force_web = request.form.get('web') == 'true'
        is_temp = request.form.get('temp') == 'true'
        temp_id = request.form.get('temp_id', '').strip()
        think_mode = request.form.get('think_mode', 'auto')
        file = request.files.get('file')
        if file and file.filename:
            file_text = extract_text_from_file(file)[:MAX_FILE_TEXT]
            has_file = True
    else:
        data = request.json
        text = data.get('message', '').strip()
        model_name = data.get('model', DEFAULT_MODEL)
        force_web = data.get('web', False)
        is_temp = data.get('temp') == 'true'
        temp_id = data.get('temp_id', '').strip()
        think_mode = data.get('think_mode', 'auto')

    if file_text:
        # v6.3.2: 纯抄写需求直接返回 OCR 结果，绕过 LLM，避免幻觉
        EXTRACT_KEYWORDS = [
            "写了什么", "什么字", "什么内容", "识别", "提取", "抄",
            "内容是什么", "读出来", "念出来", "写了啥", "啥字", "有什么字",
        ]
        user_q = (text or "").strip()

        # 纯抄写模式：问题为空 或 命中关键词
        if not user_q or any(kw in user_q for kw in EXTRACT_KEYWORDS):
            def _ocr_only():
                yield "__OCR_DIRECT__\n"
                yield "```\n"
                yield file_text
                yield "\n```"

            return Response(
                stream_with_context(_ocr_only()),
                mimetype="text/plain; charset=utf-8"
            )

        # 需要解释模式：走 LLM
        text = (
            f"图片 OCR 识别结果：\n"
            f"```\n{file_text}\n```\n\n"
            f"用户问题：{user_q}"
        )
    text = clean_surrogates(text)
    text = normalize_input(text)

    if not text:
        return Response("请输入内容。", mimetype="text/plain; charset=utf-8")

    return Response(
        stream_with_context(generate_stream(text, model_name, force_web, has_file, is_temp, temp_id, think_mode)),
        mimetype="text/plain; charset=utf-8"
    )
@app.route("/reset", methods=["POST"])
def reset():
    global current_session_id
    guard = guard_spectator()
    if guard: return guard
    if current_session_id:
        delete_session(current_session_id)
        current_session_id = None
    return jsonify({"ok": True})

# ================== OpenAI 兼容 API ==================
@app.route("/v1/models", methods=["GET"])
def openai_models():
    models = []
    for name in AVAILABLE_MODELS.keys():
        models.append({"id": name, "object": "model", "created": int(time.time()), "owned_by": "local"})
    return jsonify({"object": "list", "data": models})

@app.route("/v1/chat/completions", methods=["POST"])
def openai_chat():
    data = request.json or {}
    messages = data.get("messages", [])
    model_name = data.get("model", DEFAULT_MODEL)
    stream = data.get("stream", False)
    temperature = data.get("temperature", TEMPERATURE)
    max_tokens = data.get("max_tokens", MAX_TOKENS)

    if not messages:
        return jsonify({"error": {"message": "messages is required"}}), 400

    user_text = ""
    for m in messages:
        role = m.get("role", "")
        content = m.get("content", "")
        if isinstance(content, list):
            content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
        if role == "system":
            user_text = f"[系统指令] {content}\n\n{user_text}"
        elif role == "user":
            user_text += content + "\n"
        elif role == "assistant":
            user_text += f"[历史回复] {content}\n"

    is_temp = request.form.get('temp') == 'true'
    temp_id = request.form.get('temp_id', '').strip()
    if is_temp:
        with TEMP_LOCK:
            temp_history = list(TEMP_SESSIONS.get(temp_id, []))
    else:
        temp_history = None
    user_text = user_text.strip()
    if model_name not in AVAILABLE_MODELS:
        model_name = DEFAULT_MODEL

    try:
        load_model(model_name)
    except Exception as e:
        return jsonify({"error": {"message": f"模型加载失败：{e}"}}), 500

    if not stream:
        prompt = clean_surrogates(build_prompt(user_text, None, history_override=temp_history))
        try:
            LLM_LOCK.acquire()
            try:
                output = llm(prompt, max_tokens=max_tokens, temperature=temperature,
                             top_p=TOP_P, repeat_penalty=1.3, stop=["<|im_end|>"], echo=False)
            finally:
                LLM_LOCK.release()
            reply = output["choices"][0]["text"].strip()
            if OPENCC_AVAILABLE:
                reply = cc.convert(reply)
        except Exception as e:
            return jsonify({"error": {"message": str(e)}}), 500

        return jsonify({
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model_name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": reply}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        })

    def generate():
        prompt = clean_surrogates(build_prompt(user_text, None, history_override=temp_history))
        LLM_LOCK.acquire()
        try:
            stream_iter = llm(prompt, max_tokens=max_tokens, temperature=temperature,
                              top_p=TOP_P, repeat_penalty=1.3,
                              stop=["<|im_end|>"], echo=False, stream=True)
            for chunk in stream_iter:
                token = chunk["choices"][0]["text"]
                if not token:
                    continue
                if OPENCC_AVAILABLE:
                    token = cc.convert(token)
                yield token  # 你原有逻辑，保持
        finally:
            LLM_LOCK.release()

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404

@app.errorhandler(500)
def server_error(e):
    return render_template("500.html"), 500

# ================== 启动 ==================
def play_bell(times=3, interval=0.5):
    def _play():
        for _ in range(times):
            subprocess.run(["afplay", "/System/Library/Sounds/Hero.aiff"])
            time.sleep(interval)
    threading.Thread(target=_play, daemon=True).start()

def wait_for_server(port=5001, timeout=60):
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            s.connect(("127.0.0.1", port))
            s.close()
            play_bell(3, 0.5)
            print("✅ 已完成 —— 浏览器可以访问了：http://127.0.0.1:5001/login\n" if ACCESS_PASSWORD else "✅ 已完成 —— 浏览器可以访问了：http://127.0.0.1:5001\n")
            return
        except Exception:
            time.sleep(0.5)
    print("\n⚠️ 服务器启动超时\n")

# ================== v6.01 管理员接口 ==================
@app.route("/admin/all_users_sessions", methods=["GET"])
def admin_all_users_sessions():
    """管理员：一次获取所有用户及其会话索引"""
    if not is_admin():
        return jsonify({"error": "无权限"}), 403
    result = []
    for u in list_all_users():
        idx = load_index(u)
        result.append({"user": u, "sessions": idx})
    return jsonify(result)


@app.route("/admin/user_session/<username>/<sid>", methods=["GET"])
def admin_user_session_detail(username, sid):
    """管理员：读取某用户某会话的完整消息"""
    if not is_admin():
        return jsonify({"error": "无权限"}), 403
    if not os.path.isdir(user_dir(username)):
        return jsonify({"error": "用户不存在"}), 404
    return jsonify(load_session(sid, username))

# ================== v6.3.0 创作设置接口 ==================
@app.route("/style", methods=["GET"])
def get_style():
    return jsonify(settings.get("style_profile", {}))

@app.route("/style", methods=["POST"])
def set_style():
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    settings["style_profile"] = data
    save_settings()
    return jsonify({"ok": True})

@app.route("/glossary", methods=["GET"])
def get_glossary():
    return jsonify(settings.get("glossary", []))

@app.route("/glossary", methods=["POST"])
def set_glossary():
    guard = guard_spectator()
    if guard: return guard
    data = request.json or {}
    settings["glossary"] = data.get("glossary", [])
    save_settings()
    return jsonify({"ok": True})

@app.route("/persona/<name>", methods=["POST"])
def apply_persona(name):
    guard = guard_spectator()
    if guard: return guard
    personas = settings.get("writing_personas", {})
    if name not in personas:
        return jsonify({"error": "人设不存在"}), 404
    settings["system_prompt"] = personas[name]
    save_settings()
    return jsonify({"ok": True, "persona": name})

import subprocess

@app.route('/api/run_code', methods=['POST'])
def api_run_code():
    data = request.json or {}
    code = data.get('code', '')
    lang = data.get('lang', 'python') # 默认跑 Python，也可以传 'shell'
    
    if not code:
        return jsonify({'output': '没有收到代码', 'error': True})
        
    try:
        if lang == 'python':
            cmd = ['python3', '-c', code]
        else:
            cmd = code # 终端 shell 命令，比如 'ls -la'
            
        # 运行命令，捕获输出，设置 5 秒超时防止死循环
        result = subprocess.run(
            cmd, 
            shell=(lang=='shell'), 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        
        output = result.stdout if result.stdout else result.stderr
        return jsonify({'output': output, 'error': False})
    except subprocess.TimeoutExpired:
        return jsonify({'output': '运行超时（超过 5 秒被强制终止）', 'error': True})
    except Exception as e:
        return jsonify({'output': str(e), 'error': True})

if __name__ == "__main__":
    threading.Thread(target=wait_for_server, daemon=True).start()
    app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)