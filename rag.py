import os
import re
import json
import numpy as np
from pypdf import PdfReader

DOCS_DIR = "./docs"
EMBED_CACHE = "./docs/.rag_cache.npz"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 80
TOP_K = 3
MIN_SCORE = 0.35      # 余弦相似度阈值（0-1，越高越严格）

MODEL_NAME = "BAAI/bge-small-zh-v1.5"   # 中文小模型，约 100MB

_chunks = []
_embeddings = None
_model = None

def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def _chunk_text(text, source):
    chunks = []
    step = CHUNK_SIZE - CHUNK_OVERLAP
    for i in range(0, len(text), step):
        chunk = text[i:i + CHUNK_SIZE].strip()
        if len(chunk) >= 20:
            chunks.append({"source": source, "text": chunk})
    return chunks

def _read_file(path):
    lower = path.lower()
    if lower.endswith(('.txt', '.md')):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    if lower.endswith('.pdf'):
        reader = PdfReader(path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return None

def load_docs():
    """加载所有文档并计算嵌入向量"""
    global _chunks, _embeddings

    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR, exist_ok=True)
        _chunks = []
        _embeddings = None
        return

    _chunks = []
    for root, _, files in os.walk(DOCS_DIR):
        for fname in files:
            if fname.startswith('.'):
                continue
            path = os.path.join(root, fname)
            try:
                text = _read_file(path)
                if text:
                    _chunks.extend(_chunk_text(text, fname))
            except Exception as e:
                print(f"⚠️ 读取 {path} 失败：{e}")

    if not _chunks:
        _embeddings = None
        return

    # 尝试从缓存加载
    if os.path.exists(EMBED_CACHE):
        try:
            cache = np.load(EMBED_CACHE, allow_pickle=True)
            cached_texts = list(cache["texts"])
            current_texts = [c["text"] for c in _chunks]
            if cached_texts == current_texts:
                _embeddings = cache["embeddings"]
                return
        except Exception as e:
            print(f"⚠️ 缓存失效：{e}")

    # 计算嵌入
    model = _get_model()
    texts = [c["text"] for c in _chunks]
    _embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    # 保存缓存
    try:
        np.savez_compressed(
            EMBED_CACHE,
            texts=np.array(texts, dtype=object),
            embeddings=_embeddings
        )
    except Exception as e:
        print(f"⚠️ 缓存保存失败：{e}")

def search(query, top_k=TOP_K):
    """语义检索（v6.0.3：动态阈值）"""
    if not _chunks or _embeddings is None or not query.strip():
        return []

    # v6.0.3: 根据问题长度动态调阈值
    qlen = len(query.strip())
    if qlen < 8:
        threshold = MIN_SCORE + 0.10          # 0.45，短问题从严
    elif qlen > 25:
        threshold = max(0.20, MIN_SCORE - 0.05)  # 0.30，长问题放宽
    else:
        threshold = MIN_SCORE                 # 0.35，常规

    model = _get_model()
    q_emb = model.encode([query], normalize_embeddings=True)[0]

    # 余弦相似度（向量已归一化，点积即余弦）
    scores = _embeddings @ q_emb

    # 排序
    idx_sorted = np.argsort(-scores)[:top_k]

    results = []
    for idx in idx_sorted:
        score = float(scores[idx])
        if score >= threshold:
            results.append({**_chunks[idx], "score": score})

    return results

def format_context(results):
    if not results:
        return None
    parts = []
    for i, r in enumerate(results, 1):
        parts.append(f"[资料{i}·{r['source']}]\n{r['text']}")
    return "\n\n".join(parts)

def has_index():
    return len(_chunks) > 0 and _embeddings is not None

def reload():
    # 删掉缓存，强制重算
    if os.path.exists(EMBED_CACHE):
        try:
            os.remove(EMBED_CACHE)
        except Exception:
            pass
    load_docs()