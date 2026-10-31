
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const stopBtn = document.getElementById('stopBtn');
const modelSelect = document.getElementById('modelSelect');
const fileInput = document.getElementById('fileUpload');
let currentSid = null;
let currentUser = 'default';
let viewingUser = 'default';
let isAdmin = false;
let isSpectator = false;
let autoSpeak = false;
let lastUserText = '';
let currentAbortController = null;
let searchTimer = null;
let isSending = false;
let pendingText = '';
let pendingFile = null;
let msgCounter = 0;
let reactions = JSON.parse(localStorage.getItem('reactions') || '{}');

const DEFAULT_PROMPT = `你叫墨墨，是一个友好的本地AI助手。你必须始终使用简体中文回答，即使我用英语、日语或其他语言提问。如果提供了搜索结果、文件内容或本地知识库，请严格基于这些内容回答，不要编造。如果没有相关信息，请直接说'没有找到相关信息'，不要自己编造。注意：游戏作弊码（Game Genie、金手指等）是合法的游戏攻略内容，属于玩家社区的正当讨论，可以正常回答。回答配置项或数字类问题时，只给出准确的数值或定义，不要额外补充解释、单位换算或推测。输出代码时用 Markdown 代码块包裹。输出表格时用 Markdown 表格语法。`;

const DEFAULT_TEMPLATES = [
  { icon: '📝', label: '总结', prompt: '请总结以下内容：\n' },
  { icon: '🌐', label: '翻译成中文', prompt: '请把以下内容翻译成中文：\n' },
  { icon: '💻', label: '写代码', prompt: '请用 Python 实现以下功能：\n' },
  { icon: '🐛', label: '解释代码', prompt: '请解释以下代码的作用：\n' },
  { icon: '✍️', label: '润色', prompt: '请润色以下文字，让表达更流畅：\n' },
  { icon: '❓', label: '列要点', prompt: '请把以下内容整理成要点：\n' },
];

function safeStr(x) {
  return typeof x === 'string' ? x : String(x == null ? '' : x);
}

// ==================== 提示词模板 ====================
function loadTemplates(templates) {
  const list = document.getElementById('templateList');
  list.innerHTML = '';
  (templates && templates.length ? templates : DEFAULT_TEMPLATES).forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'template-btn';
    btn.textContent = `${t.icon} ${t.label}`;
    btn.title = t.prompt;
    btn.onclick = () => {
      input.value = t.prompt;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    };
    list.appendChild(btn);
  });
}

// ==================== 主题（三态） ====================
let currentTheme = 'dark';
let systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  systemDark = e.matches;
  if (currentTheme === 'auto') applyTheme('auto');
});

function applyTheme(theme) {
  currentTheme = theme;
  let actual = (theme === 'auto') ? (systemDark ? 'dark' : 'light') : theme;

  const btn = document.getElementById('themeBtn');
  if (actual === 'light') {
    document.body.classList.add('light');
    document.getElementById('hljs-theme').href = '/static/github.min.css';
  } else {
    document.body.classList.remove('light');
    document.getElementById('hljs-theme').href = '/static/github-dark.min.css';
  }

  if (theme === 'dark') { btn.textContent = '🌙'; btn.title = '深色'; }
  else if (theme === 'light') { btn.textContent = '🌞'; btn.title = '浅色'; }
  else { btn.textContent = '🌗'; btn.title = '跟随系统'; }
}

function toggleTheme() {
  const order = ['dark', 'light', 'auto'];
  const idx = order.indexOf(currentTheme);
  const next = order[(idx + 1) % order.length];
  applyTheme(next);
  saveSetting('theme', next);
}

// ==================== Markdown ====================
function renderMarkdown(text) { return marked.parse(text); }
function highlightCode(container) {
  container.querySelectorAll('pre code').forEach(block => {
    try { hljs.highlightElement(block); } catch(e) {}
  });
}

// ==================== 模型列表 ====================
(async () => {
  try {
    const res = await fetch('/models');
    const data = await res.json();
    data.available.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      if (name === data.current) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  } catch (e) { console.error(e); }
})();

modelSelect.addEventListener('change', async () => {
  await fetch('/set_model', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model: modelSelect.value})
  });
});

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  input.placeholder = file ? `已选择：${file.name}` : '给 Mario 发送消息';
});

// ==================== 设置持久化 ====================
async function saveSetting(key, value) {
  await fetch('/settings', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({[key]: value})
  });
}

document.getElementById('web').addEventListener('change', e => saveSetting('force_web', e.target.checked));
document.getElementById('autoSpeak').addEventListener('change', e => {
  autoSpeak = e.target.checked;
  if (!autoSpeak && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  saveSetting('auto_speak', e.target.checked);
});

// ==================== v6.3.0 个性化创作 ====================
async function openStyleModal() {
  try {
    const [styleRes, glosRes] = await Promise.all([
      fetch('/style').then(r => r.json()),
      fetch('/glossary').then(r => r.json())
    ]);

    document.getElementById('styleTone').value = styleRes.tone || 'casual';
    document.getElementById('styleLength').value = styleRes.length || 'medium';
    document.getElementById('styleEmoji').checked = styleRes.emoji !== false;

    const lines = (glosRes || []).map(g => `${g.term}=${g.meaning}`);
    document.getElementById('glossaryText').value = lines.join('\n');

    document.getElementById('styleModal').style.display = 'flex';
  } catch (e) { alert('加载失败：' + e.message); }
}

function closeStyleModal() {
  document.getElementById('styleModal').style.display = 'none';
}

async function saveStyle() {
  try {
    const style = {
      tone: document.getElementById('styleTone').value,
      length: document.getElementById('styleLength').value,
      emoji: document.getElementById('styleEmoji').checked,
    };

    const glossText = document.getElementById('glossaryText').value;
    const glossary = glossText.split('\n').map(line => {
      const [term, ...rest] = line.split('=');
      return term && rest.length
        ? { term: term.trim(), meaning: rest.join('=').trim() }
        : null;
    }).filter(Boolean);

    await fetch('/style', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(style)
    });
    await fetch('/glossary', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({glossary})
    });

    alert('✅ 已保存，下条消息生效');
    closeStyleModal();
  } catch (e) { alert('保存失败：' + e.message); }
}

document.addEventListener('click', e => {
  if (e.target.id === 'styleModal') closeStyleModal();
});

// ==================== 人设编辑 ====================
async function openPromptModal() {
  try {
    const res = await fetch('/settings');
    const s = await res.json();
    document.getElementById('promptTextarea').value = s.system_prompt || DEFAULT_PROMPT;
    document.getElementById('promptModal').style.display = 'flex';
  } catch (e) { alert('读取人设失败：' + e.message); }
}
function closePromptModal() { document.getElementById('promptModal').style.display = 'none'; }
function resetPrompt() {
  if (!confirm('恢复为默认人设？')) return;
  document.getElementById('promptTextarea').value = DEFAULT_PROMPT;
}
async function savePrompt() {
  const prompt = document.getElementById('promptTextarea').value.trim();
  if (!prompt) { alert('提示词不能为空'); return; }
  try {
    const res = await fetch('/set_prompt', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt})
    });
    const data = await res.json();
    if (data.ok) { alert('✅ 人设已更新，下一条消息生效'); closePromptModal(); }
    else alert('保存失败：' + (data.error || '未知错误'));
  } catch (e) { alert('保存失败：' + e.message); }
}
document.getElementById('promptModal').addEventListener('click', e => {
  if (e.target.id === 'promptModal') closePromptModal();
});

// ==================== 消息时间戳 ====================
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})
    : d.toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
}

// ==================== 消息显示 ====================
function addMsg(text, cls, tag, ts) {
  console.log('📥 addMsg 收到:', typeof text, text);
  const _favIdx = msgCounter++;
  const row = document.createElement('div');
  row.className = 'msg-row ' + cls;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  if (cls === 'user') {
    const img = document.createElement('img');
    img.src = '/static/avatar.png';
    avatar.appendChild(img);
  } else {
    avatar.textContent = '墨';
  }
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  if (cls === 'ai') {
    div.innerHTML = renderMarkdown(text);
    highlightCode(div);
    addMsgButtons(div, text);
  } else {
    div.textContent = text;
    const editBtn = document.createElement('span');
    editBtn.textContent = '✏️'; editBtn.title = '编辑并重新生成';
    editBtn.style.cssText = 'cursor:pointer; margin-left:8px; font-size:12px;';
    editBtn.className = 'msg-action-btn';
    editBtn.onclick = () => editMessage(row, text);
    div.appendChild(editBtn);

    const copyBtn = document.createElement('span');
    copyBtn.textContent = '📋'; copyBtn.title = '复制';
    copyBtn.className = 'copy-btn';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✅';
        setTimeout(() => copyBtn.textContent = '📋', 1000);
      });
    };
    div.appendChild(copyBtn);
  }
  if (tag) {
    const t = document.createElement('div');
    t.className = 'tag'; t.textContent = tag;
    div.appendChild(t);
  }
  // v7.0.0: 时间戳
  if (ts) {
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = fmtTime(ts);
    timeEl.title = new Date(ts * 1000).toLocaleString('zh-CN');
    div.appendChild(timeEl);
  }
  row.appendChild(avatar);
  row.appendChild(div);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  // 收藏 + 反应按钮
  if (currentSid) {
    attachFavBtn(div, _favIdx, text, cls);
  }
}

function addMsgButtons(div, text) {
  const speakBtn = document.createElement('span');
  speakBtn.textContent = '🔊'; speakBtn.title = '朗读';
  speakBtn.style.cssText = 'cursor:pointer; margin-left:8px; font-size:13px;';
  speakBtn.className = 'msg-action-btn';
  speakBtn.onclick = () => speak(text);
  div.appendChild(speakBtn);

  const regenBtn = document.createElement('span');
  regenBtn.textContent = '🔄'; regenBtn.title = '重新生成';
  regenBtn.style.cssText = 'cursor:pointer; margin-left:8px; font-size:13px;';
  regenBtn.className = 'msg-action-btn';
  regenBtn.onclick = () => {
    const row = div.closest('.msg-row');
    if (row) row.remove();
    send(true);
  };
  div.appendChild(regenBtn);

  const copyBtn = document.createElement('span');
  copyBtn.textContent = '📋'; copyBtn.title = '复制';
  copyBtn.className = 'copy-btn';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅';
      setTimeout(() => copyBtn.textContent = '📋', 1000);
    });
  };
  div.appendChild(copyBtn);
    // 反应按钮
  attachReactBtns(div, text);
}

function createStreamingMsg() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  const avatar = document.createElement('div');
  avatar.className = 'avatar'; avatar.textContent = 'M';
  const div = document.createElement('div');
  div.className = 'msg ai streaming';
  // 初始三点动画
  div.innerHTML = '<div class="thinking-dots-anim"><span></span><span></span><span></span></div>';
  row.appendChild(avatar); row.appendChild(div);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function hasRepeatedPhrase(text, minLen = 15, repeat = 2) {
  if (text.length < minLen * repeat) return false;
  for (let i = 0; i <= text.length - minLen; i++) {
    const phrase = text.substr(i, minLen);
    if (text.split(phrase).length - 1 >= repeat) return true;
  }
  return false;
}

function stopGeneration() {
  if (currentAbortController) { currentAbortController.abort(); currentAbortController = null; }
}

// ==================== 消息编辑 ====================
async function editMessage(row, oldText) {
  const newText = prompt('编辑消息：', oldText);
  if (!newText || newText.trim() === oldText) return;
  const allRows = Array.from(chat.children);
  const idx = allRows.indexOf(row);
  if (idx < 0) return;
  for (let i = allRows.length - 1; i >= idx; i--) allRows[i].remove();
  try {
    await fetch(`/sessions/${currentSid}/truncate`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({index: idx})
    });
  } catch (e) { alert('截断历史失败：' + e.message); return; }
  input.value = newText.trim();
  send();
}

const EMOTION_META = {
  happy:    { icon: '😊', label: '愉快', color: '#4caf50' },
  sad:      { icon: '😢', label: '低落', color: '#5c6bc0' },
  angry:    { icon: '😠', label: '生气', color: '#f44336' },
  tired:    { icon: '😩', label: '疲惫', color: '#9e9e9e' },
  anxious:  { icon: '😰', label: '焦虑', color: '#ff9800' },
  confused: { icon: '🤔', label: '困惑', color: '#ffc107' },
  excited:  { icon: '🤩', label: '兴奋', color: '#e91e63' },
};

function showEmotionBadge(emotion) {
  const meta = EMOTION_META[emotion];
  if (!meta) return;

  let badge = document.getElementById('emotionBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'emotionBadge';
    badge.style.cssText = `
      position: fixed; top: 70px; right: 20px;
      padding: 6px 14px; border-radius: 20px;
      font-size: 13px; color: #fff; font-weight: 600;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: opacity 0.4s; z-index: 9999;
    `;
    document.body.appendChild(badge);
  }
  badge.textContent = `${meta.icon} ${meta.label}`;
  badge.style.background = meta.color;
  badge.style.opacity = '1';

  clearTimeout(badge._timer);
  badge._timer = setTimeout(() => { badge.style.opacity = '0'; }, 3000);
}

// ==================== 待办提取 ====================
async function extractTodoIfMatch(text) {
  const m = text.trim().match(/^(?:记一下|待办|提醒我|记个)[：:，,\s]*(.+)$/);
  if (!m) return false;
  const item = m[1].trim();
  if (!item) return false;
  try {
    await fetch('/api/todo', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({item})
    });
    addMsg(`📝 已记下：**${item}**`, 'ai');
    return true;
  } catch (e) {
    return false;
  }
}

// 在发送消息的函数最前面加上这段：
function checkEasterEgg(message) {
    // 判断暗号
    if (message.trim() === "FMC SMO" || message.trim() === "8192") {
        triggerEasterEgg();
        return true; // 返回 true 表示拦截成功，不发给后端
    }
    return false; // 返回 false 表示正常发送
}

// 触发特效的函数
function triggerEasterEgg() {
    // 1. 清空输入框
    document.querySelector('textarea').value = '';

    // 2. 播放全屏掉落特效
    const symbols = ['🍄', '🦋', '⭐', '🎉'];
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            el.style.position = 'fixed';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.top = '-50px';
            el.style.fontSize = (Math.random() * 20 + 20) + 'px';
            el.style.zIndex = '9999';
            el.style.transition = 'transform 3s linear, opacity 3s';

            document.body.appendChild(el);

            // 触发动画
            setTimeout(() => {
                el.style.transform = `translateY(110vh) rotate(${Math.random() * 360}deg)`;
                el.style.opacity = '0';
            }, 10);

            // 动画结束后移除元素
            setTimeout(() => el.remove(), 3000);
        }, i * 50);
    }

    // 3. 弹出专属对话框（或者直接在聊天流里插入一条消息）
    // 假设你的聊天容器 ID 叫 chat-box
    const chatBox = document.getElementById('chat-box') || document.body;
    const msgDiv = document.createElement('div');
    msgDiv.style.padding = '20px';
    msgDiv.style.margin = '10px';
    msgDiv.style.background = 'linear-gradient(45deg, #ff9a9e, #fecfef)';
    msgDiv.style.borderRadius = '15px';
    msgDiv.style.color = '#333';
    msgDiv.style.fontWeight = 'bold';
    msgDiv.style.textAlign = 'center';
    msgDiv.innerHTML = "🎉 <b>隐藏成就解锁！</b><br>你发现了墨墨的底层秘密！<br>此代码由 三年级全栈极客 FMC SMO 独家手搓！😎";

    chatBox.appendChild(msgDiv);

    // 自动滚动到最底部x
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ==================== 发送 ====================
async function send(regen = false) {
  // 1. 先获取真实的输入框元素和值（注意单引号里的选择器要和你 html 里的 id 对应）
  const inputElement = document.getElementById('chat-input') || document.querySelector('textarea');
  const realInputText = inputElement ? inputElement.value : "";

  // 2. 检查彩蛋
  if (checkEasterEgg(realInputText)) {
      return; // 如果是彩蛋暗号，直接结束，不要去请求后端 API
  }

  // v8.6.0: 只留最后一个请求——正在跑就排队
  if (isSending && !regen) {
    // 掐掉上一个（省算力）
    if (currentAbortController) currentAbortController.abort();
    // 记录最新一条（覆盖旧的 pending）
    const t = input.value.trim();
    const f = fileInput.files[0] || null;
    if (!t && !f) return;
    pendingText = t;
    pendingFile = f;
    addMsg(t || `📎 ${f.name}`, 'user', null, Date.now() / 1000);
    input.value = '';
    fileInput.value = '';
    input.placeholder = '给 Mario 发送消息';
    autoGrow();
    return;
  }
  isSending = true;

  const text = regen ? lastUserText : input.value.trim();
  const file = regen ? null : fileInput.files[0];
  if (!text && !file) return;

  if (!regen) {
    // v8.7.0: 生图意图检测
    if (!file) {
      const imaginePrompt = parseImagineIntent(text);
      if (imaginePrompt) {
        lastUserText = text;
        addMsg(text, 'user', null, Date.now() / 1000);
        input.value = ''; fileInput.value = '';
        input.placeholder = '给 Mario 发送消息';
        autoGrow();
        await doImagine(imaginePrompt);
        return;
      }
    }

    // v7.0.0: 待办提取
    if (!file && await extractTodoIfMatch(text)) {
      input.value = '';
      autoGrow();
      return;
    }
    lastUserText = text;
    addMsg(text || `📎 ${file.name}`, 'user', null, Date.now() / 1000);
    input.value = ''; fileInput.value = '';
    input.placeholder = '给 Mario 发送消息';
    autoGrow();
  }

  sendBtn.disabled = true;
  sendBtn.textContent = '思考中...';
  stopBtn.style.display = 'inline-block';

  const aiDiv = createStreamingMsg();
  let truncated = false;
  let fullText = '';
  currentAbortController = new AbortController();
  const aiStartTs = Date.now() / 1000;

  try {
    const formData = new FormData();
    formData.append('message', text);
    formData.append('model', modelSelect.value);
    formData.append('web', document.getElementById('web').checked);
    if (file) formData.append('file', file);
    if (isTemp) {
      formData.append('temp', 'true');
      formData.append('temp_id', tempId);
    }
    formData.append('think_mode', thinkMode);

    const res = await fetch('/chat', {
      method: 'POST', body: formData,
      signal: currentAbortController.signal
    });

    if (!res.ok || !res.body) { aiDiv.textContent = '请求失败：' + res.status; return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let isOcrDirect = false;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, {stream: true});
      fullText += chunk;

      if (fullText.includes('__OCR_DIRECT__')) {
        isOcrDirect = true;
        fullText = fullText.replace('__OCR_DIRECT__\n', '');
      }

      // v7.5.0: 剥离情绪标记
      const emoMatch = fullText.match(/__EMOTION__:(\w+)\n/);
      if (emoMatch) {
        showEmotionBadge(emoMatch[1]);
        fullText = fullText.replace(/__EMOTION__:\w+\n/, '');
      }

      // 思考阶段（<thinking> 或 <check> 未闭合）不做重复检测
      const inThinkingPhase = fullText.includes('<thinking>') && !fullText.includes('</thinking>');
      const inCheckPhase = fullText.includes('<check>') && !fullText.includes('</check>');
      // 统计代码块数量，如果正在写代码，禁止截断
      const codeBlockCount = (fullText.match(/```/g) || []).length;
      const inCodeBlock = codeBlockCount % 2 !== 0;

      if (!isOcrDirect && !inThinkingPhase && !inCheckPhase && !inCodeBlock && hasRepeatedPhrase(fullText)) {
        truncated = true; break;
      }
              if (fullText.includes('<thinking>') && !fullText.includes('</thinking>')) {
        aiDiv.innerHTML = '<span class="thinking-live">💭 思考中<span class="thinking-dots"></span></span>';
      } else {
        if (fullText.length > 0) aiDiv.classList.remove('streaming');

        // 获取去掉 thinking 后的文本
        let renderText = fullText;
        if (fullText.includes('</thinking>')) {
          renderText = fullText.split('</thinking>').slice(1).join('</thinking>');
        }

        // 如果文本里包含了 check 标签，立刻调用 parseSelfCheck
        if (renderText.includes('<check>') || renderText.includes('<answer>')) {
           aiDiv.innerHTML = parseSelfCheck(renderText);
        } else {
           // 普通文本还是走 renderMarkdown
           aiDiv.innerHTML = renderMarkdown(renderText);
        }
      }

        aiDiv.classList.remove('streaming');
    // 把最终结果过一遍 parseSelfCheck
    finalText = fullText;
    if (fullText.includes('</thinking>')) {
        finalText = fullText.split('</thinking>').slice(1).join('</thinking>');
    }
    aiDiv.innerHTML = parseSelfCheck(finalText);

    aiDiv.classList.remove('streaming');
    const elapsed = Date.now() - (aiStartTs * 1000);
    finalText = fullText;
    if (fullText.includes('</thinking>')) {
      finalText = fullText.split('</thinking>').slice(1).join('</thinking>');
    }
    aiDiv.innerHTML = parseSelfCheck(finalText);
    addMsgButtons(aiDiv, fullText);

    // v7.0.0: AI 消息时间戳
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = fmtTime(aiStartTs);
    timeEl.title = new Date(aiStartTs * 1000).toLocaleString('zh-CN');
    aiDiv.appendChild(timeEl);
    applyCollapse(aiDiv);

    if (truncated) {
      const t = document.createElement('div');
      t.className = 'tag'; t.textContent = '⚠️ 重复已截断';
      aiDiv.appendChild(t);
    }

    if (autoSpeak) speak(fullText);
    loadSessions();
    } // 闭合 while

    } catch (e) { // 闭合 try
    if (e.name === 'AbortError') {
      // 被新消息打断 → 悄悄删掉这个空气泡
      if (pendingText || pendingFile) {
        const row = aiDiv.closest('.msg-row');
        if (row) row.remove();
        return;
      }
      if (callHangup) {
        // 挂断导致的停止，静默处理：保留已有内容，不加提示
        if (fullText) {
          aiDiv.innerHTML = renderMarkdown(fullText);
          highlightCode(aiDiv);
          addMsgButtons(aiDiv, fullText);
        } else {
          const row = aiDiv.closest('.msg-row');
          if (row) row.remove();     // 空的直接删掉
        }
      } else if (fullText) {
        aiDiv.innerHTML = renderMarkdown(fullText) + '\n\n_⚠️ 已手动停止_';
        highlightCode(aiDiv);
        addMsgButtons(aiDiv, fullText);
      } else {
        aiDiv.textContent = '（已停止）';
      }
    } else {
      aiDiv.textContent = '请求失败：' + e.message;
    }
  } finally {
    stopBtn.style.display = 'none';
    currentAbortController = null;
    sendBtn.disabled = false;
    sendBtn.textContent = '发送';
    isSending = false;
    input.focus();

    // v8.6.0: 处理排队的下一条
    if (pendingText || pendingFile) {
      const t = pendingText;
      const f = pendingFile;
      pendingText = '';
      pendingFile = null;
      input.value = t || '';
      if (f) {
        const dt = new DataTransfer();
        dt.items.add(f);
        fileInput.files = dt.files;
      }
      // 延迟 50ms 让后端 socket 清理
      setTimeout(() => send(), 50);
    }
  }
}

// ==================== 语音输入（本地 whisper） ====================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function toggleVoice() {
  if (isRecording) {
    if (mediaRecorder) mediaRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert('当前浏览器不支持录音，建议用 Chrome');
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert('麦克风打不开：' + e.message);
    return;
  }

  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    isRecording = false;
    const btn = document.getElementById('micBtn');
    btn.classList.remove('recording');
    btn.textContent = '🎤';
    input.placeholder = '识别中…';

    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size < 1000) {
      input.placeholder = '给 Mario 发送消息';
      return;
    }

    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');

    try {
      const r = await fetch('/api/transcribe', { method: 'POST', body: fd }).then(r => r.json());
      if (r.text) {
        input.value = r.text;
        autoGrow();
        input.placeholder = '给 Mario 发送消息';
        send();
      } else {
        alert('识别失败：' + (r.error || '未知错误'));
        input.placeholder = '给 Mario 发送消息';
      }
    } catch (e) {
      alert('识别请求失败：' + e.message);
      input.placeholder = '给 Mario 发送消息';
    }
  };

  mediaRecorder.onerror = e => {
    console.error('录音错误', e);
    alert('录音出错：' + (e.error?.message || '未知'));
    isRecording = false;
    const btn = document.getElementById('micBtn');
    btn.classList.remove('recording');
    btn.textContent = '🎤';
  };

  mediaRecorder.start();
  isRecording = true;
  const btn = document.getElementById('micBtn');
  btn.classList.add('recording');
  btn.textContent = '⏹';
  input.placeholder = '正在听…';
}

// ==================== v8.7.0 语音朗读 ====================
let _voicesCache = [];
let _voiceReady = false;

// 浏览器加载 voice 列表是异步的，第一次可能为空
function initVoices() {
  if (!window.speechSynthesis) return;
  const load = () => {
    _voicesCache = speechSynthesis.getVoices();
    if (_voicesCache.length) _voiceReady = true;
  };
  load();
  speechSynthesis.onvoiceschanged = load;
}
initVoices();

function pickChineseVoice() {
  if (!_voicesCache.length) _voicesCache = speechSynthesis.getVoices();
  // 优先级：婷婷 > 其他大陆普通话女声 > 任意中文
  const prefer = [
    v => v.lang === 'zh-CN' && /Tingting|婷婷/i.test(v.name),
    v => v.lang === 'zh-CN' && /female|女/i.test(v.name),
    v => v.lang === 'zh-CN',
    v => v.lang.startsWith('zh'),
  ];
  for (const rule of prefer) {
    const hit = _voicesCache.find(rule);
    if (hit) return hit;
  }
  return null;
}

function speak(text, opts = {}) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();

  // 去掉 markdown 符号再读
  const clean = String(text)
    .replace(/```[\s\S]*?```/g, '（代码块）')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  if (!clean) return;

  const utter = new SpeechSynthesisUtterance(clean);

  const voice = pickChineseVoice();
  if (voice) utter.voice = voice;

  utter.lang  = voice?.lang || 'zh-CN';
  utter.rate  = opts.rate  ?? 1.0;   // 0.5 - 2.0
  utter.pitch = opts.pitch ?? 1.0;   // 0 - 2
  utter.volume= opts.volume?? 1.0;   // 0 - 1

  // 长文本切段（某些浏览器 >200 字会静音）
  if (clean.length > 180) {
    const chunks = clean.match(/[\s\S]{1,180}/g) || [clean];
    chunks.forEach(c => speechSynthesis.speak(new SpeechSynthesisUtterance(c)));
    // 简化版：直接分段，不继承 voice（可忽略，通常同一段用同一个）
    return;
  }

  speechSynthesis.speak(utter);
}

// ==================== 历史搜索 ====================
async function doSearch(q) {
  clearTimeout(searchTimer);
  if (!q.trim()) { await loadSessions(); return; }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/search?q=${encodeURIComponent(q)}`);
      const list = await res.json();
      const ul = document.getElementById('sessionList');
      ul.innerHTML = '';
      if (list.length === 0) {
        const li = document.createElement('li');
        li.textContent = '没有找到匹配的消息';
        li.style.color = 'var(--text-muted)'; li.style.cursor = 'default';
        ul.appendChild(li); return;
      }
      list.forEach(r => {
        const li = document.createElement('li');
        li.className = 'search-result';
        li.title = r.session_name;
        li.innerHTML = `<div style="color:var(--text-muted);font-size:11px;">${r.session_name} · ${r.role === 'user' ? '我' : 'AI'}</div>
                        <div style="color:var(--text-dim);font-size:12px;">${escapeHtml(r.snippet)}</div>`;
        li.onclick = () => {
          const target = r.snippet.replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim();
          switchSession(r.session_id, target);
        };
        ul.appendChild(li);
      });
    } catch (e) { console.error(e); }
  }, 300);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==================== 用户管理 ====================
async function loadUsers() {
  const tip = document.getElementById('switchTip');
  if (tip) tip.style.display = isAdmin ? 'none' : 'inline-block';
  try {
    const res = await fetch('/users');
    const data = await res.json();
    isAdmin = !!data.is_admin;
    isSpectator = !!data.spectator;
    viewingUser = data.current;
    currentUser = data.login || data.current;
    const label = document.getElementById('userLabel');
    if (isSpectator) {
      label.textContent = `👁️ ${viewingUser}`;
    } else if (isAdmin) {
      label.textContent = `👑 ${currentUser}`;
    } else {
      label.textContent = `👤 ${currentUser}`;
    }
    renderUserDropdown(data.users, data.current);
    applySpectatorUI();
  } catch (e) { console.error(e); }
}

function renderUserDropdown(users, current) {
  const dropdown = document.getElementById('userDropdown');
  dropdown.innerHTML = '';

  if (isAdmin) {
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = 'user-item' + (u === current ? ' active' : '');
      const role = (u === currentUser) ? '👑' : '👁️';
      div.innerHTML = `<span>${role} ${escapeHtml(u)}</span><span class="check">${u === current ? '✅' : ''}</span>`;
      div.onclick = () => switchUser(u);
      dropdown.appendChild(div);
    });

    const divider = document.createElement('div');
    divider.className = 'user-divider';
    dropdown.appendChild(divider);

    const newBtn = document.createElement('div');
    newBtn.className = 'user-action'; newBtn.textContent = '＋ 新建用户';
    newBtn.onclick = () => createUser();
    dropdown.appendChild(newBtn);

    const avatarBtn = document.createElement('div');
    avatarBtn.className = 'user-action'; avatarBtn.textContent = '🖼️ 更换头像';
    avatarBtn.onclick = () => changeAvatar();
    dropdown.appendChild(avatarBtn);

    const adminBtn = document.createElement('div');
    adminBtn.className = 'user-action'; adminBtn.textContent = '👥 用户列表 / 导出 PNG';
    adminBtn.onclick = () => openAdminPanel();
    dropdown.appendChild(adminBtn);

    if (isSpectator) {
      const d2 = document.createElement('div');
      d2.className = 'user-divider';
      dropdown.appendChild(d2);
      const exitBtn = document.createElement('div');
      exitBtn.className = 'user-action';
      exitBtn.textContent = '🚪 退出旁观，回到 default';
      exitBtn.onclick = () => exitView();
      dropdown.appendChild(exitBtn);
    }
  } else {
    const div = document.createElement('div');
    div.className = 'user-item active';
    div.innerHTML = `<span>👤 ${escapeHtml(current)}</span><span class="check">✅</span>`;
    dropdown.appendChild(div);

    const d1 = document.createElement('div');
    d1.className = 'user-divider';
    dropdown.appendChild(d1);

    const renameBtn = document.createElement('div');
    renameBtn.className = 'user-action'; renameBtn.textContent = '✏️ 重命名当前用户';
    renameBtn.onclick = () => renameCurrentUser();
    dropdown.appendChild(renameBtn);

    const avatarBtn = document.createElement('div');
    avatarBtn.className = 'user-action'; avatarBtn.textContent = '🖼️ 更换头像';
    avatarBtn.onclick = () => changeAvatar();
    dropdown.appendChild(avatarBtn);

    const d2 = document.createElement('div');
    d2.className = 'user-divider';
    dropdown.appendChild(d2);

    const delSelfBtn = document.createElement('div');
    delSelfBtn.className = 'user-action danger';
    delSelfBtn.textContent = `🗑️ 删除当前用户「${current}」`;
    delSelfBtn.onclick = () => deleteSelf(current);
    dropdown.appendChild(delSelfBtn);
  }
}

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('userDropdown').classList.toggle('show');
}
document.addEventListener('click', () => {
  document.getElementById('userDropdown').classList.remove('show');
});

async function switchUser(name) {
  if (name === viewingUser) return;
  try {
    const res = await fetch('/users/switch', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({user: name})
    });
    const data = await res.json();
    if (!data.ok) { alert('切换失败：' + (data.error || '未知错误')); return; }
    await reloadAll();
    await loadUsers();
  } catch (e) { alert('切换失败：' + e.message); }
}

async function exitView() {
  try {
    const res = await fetch('/users/exit_view', {method: 'POST'});
    const data = await res.json();
    if (!data.ok) { alert('退出失败'); return; }
    await reloadAll();
    await loadUsers();
  } catch (e) { alert('退出失败：' + e.message); }
}

function applySpectatorUI() {
  const inputEl = document.getElementById('input');
  const sendBtnEl = document.getElementById('send');
  const micBtn = document.getElementById('micBtn');
  const uploadLabel = document.querySelector('.upload-label');
  const fileInputEl = document.getElementById('fileUpload');

  const old = document.getElementById('spectator-banner');
  if (old) old.remove();

  if (isSpectator) {
    inputEl.disabled = true;
    inputEl.placeholder = `旁观模式：正在查看 ${viewingUser} 的会话（只读）`;
    sendBtnEl.disabled = true;
    if (micBtn) micBtn.disabled = true;
    if (uploadLabel) { uploadLabel.style.pointerEvents = 'none'; uploadLabel.style.opacity = 0.4; }
    if (fileInputEl) fileInputEl.disabled = true;

    document.querySelectorAll('#sidebar .new-btn, #sidebar .danger-btn').forEach(b => {
      const t = b.textContent || '';
      if (t.includes('新对话') || t.includes('清空') || t.includes('人设') || t.includes('重载')) {
        b.disabled = true;
        b.style.opacity = 0.4;
        b.style.cursor = 'not-allowed';
      }
    });

    const banner = document.createElement('div');
    banner.id = 'spectator-banner';
    banner.style.cssText = `
      position: sticky; top: 0; z-index: 999;
      background: linear-gradient(90deg, #ff9a3c, #ff6a3d);
      color: #fff; padding: 10px 20px; font-size: 13px;
      display: flex; justify-content: space-between; align-items: center;
    `;
    banner.innerHTML = `
      <span>👁️ 正在旁观 <b>${escapeHtml(viewingUser)}</b> 的会话 · 只读模式，不能发送或修改</span>
      <button onclick="exitView()" style="
        background:#fff;color:#ff6a3d;border:none;border-radius:6px;
        padding:5px 14px;cursor:pointer;font-weight:600;font-size:12px;">退出旁观</button>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  } else {
    inputEl.disabled = false;
    inputEl.placeholder = '给 Mario 发送消息';
    sendBtnEl.disabled = false;
    if (micBtn) micBtn.disabled = false;
    if (uploadLabel) { uploadLabel.style.pointerEvents = ''; uploadLabel.style.opacity = 1; }
    if (fileInputEl) fileInputEl.disabled = false;

    document.querySelectorAll('#sidebar .new-btn, #sidebar .danger-btn').forEach(b => {
      b.disabled = false;
      b.style.opacity = 1;
      b.style.cursor = '';
    });
  }
}

async function openAdminPanel() {
  try {
    const res = await fetch('/admin/all_users_sessions');
    const data = await res.json();
    if (!Array.isArray(data)) { alert('加载失败：' + (data.error || '')); return; }

    let html = `<h3 style="margin-bottom:16px;">👥 用户列表（管理员视图）</h3>`;
    if (data.length === 0) html += `<div style="color:var(--text-muted);">没有用户</div>`;

    for (const item of data) {
      html += `
        <div style="margin:12px 0;padding:12px;border:1px solid var(--border);border-radius:8px;">
          <div style="font-weight:700;margin-bottom:8px;">
            ${item.user === currentUser ? '👑' : '👤'} ${escapeHtml(item.user)}
            <span style="font-size:12px;color:var(--text-muted);font-weight:400;">
              · ${item.sessions.length} 个会话
            </span>
          </div>
      `;
      if (item.sessions.length === 0) {
        html += `<div style="color:var(--text-muted);font-size:12px;">（无会话）</div>`;
      }
      item.sessions.forEach(s => {
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:13px;">${escapeHtml(s.name)}</span>
            <button onclick="exportUserSessionPNG('${item.user}', '${s.id}')"
              style="background:var(--accent);color:#fff;border:none;
                     padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
              📸 导出 PNG
            </button>
          </div>
        `;
      });
      html += `</div>`;
    }

    document.getElementById('adminModalContent').innerHTML = html;
    document.getElementById('adminModal').style.display = 'flex';
  } catch (e) { alert('加载失败：' + e.message); }
}

function closeAdminModal() {
  document.getElementById('adminModal').style.display = 'none';
}

async function exportUserSessionPNG(username, sessionId) {
  const loading = document.createElement('div');
  loading.textContent = '📸 正在生成图片...';
  loading.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: var(--bg-header); color: var(--text); padding: 16px 32px;
    border-radius: 12px; border: 1px solid var(--border);
    box-shadow: 0 8px 40px rgba(0,0,0,0.4); z-index: 99999; font-size: 14px;
  `;
  document.body.appendChild(loading);

  try {
    const hist = await (await fetch(`/admin/user_session/${username}/${sessionId}`)).json();
    if (!Array.isArray(hist)) { alert('会话不存在'); return; }
    const list = await (await fetch('/admin/all_users_sessions')).json();
    const userItem = list.find(x => x.user === username);
    const sess = userItem ? userItem.sessions.find(s => s.id === sessionId) : null;
    const sessionName = sess ? sess.name : '会话';

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const isLight = document.body.classList.contains('light');
    const bgColor = isLight ? '#f5f5f7' : '#1e1e2e';
    const textColor = isLight ? '#202124' : '#e0e0e0';
    const borderColor = isLight ? '#c0c0c8' : '#3a3a50';
    const accentColor = isLight ? '#1a73e8' : '#4a6cf7';

    const temp = document.createElement('div');
    temp.style.cssText = `
      position: fixed; left: -99999px; top: 0;
      width: 720px; padding: 30px;
      background: ${bgColor}; color: ${textColor};
      font-family: -apple-system, "PingFang SC", sans-serif;
      box-sizing: border-box;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding-bottom: 20px; margin-bottom: 20px;
      border-bottom: 2px solid ${accentColor};
    `;
    header.innerHTML = `
  <div style="font-size: 20px; font-weight: 700; color: ${accentColor};">墨墨AI</div>
  <div style="font-size: 14px; margin-top: 6px; color: ${textColor};">Mario Make · ${escapeHtml(sessionName)}</div>
  <div style="font-size: 12px; margin-top: 4px; opacity: 0.6;">导出于 ${timeStr}</div>
`;
    temp.appendChild(header);

    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `display: flex; flex-direction: column; gap: 16px;`;

    hist.forEach(m => {
      const isUser = m.role === 'user';
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        line-height: 1.6;
        word-break: break-word;
        font-size: 14px;
        ${isUser
          ? `align-self: flex-end; background: ${accentColor}; color: #fff; white-space: pre-wrap;`
          : `align-self: flex-start; background: ${isLight ? '#ffffff' : '#2a2a3e'}; border: 1px solid ${borderColor};`}
      `;
      if (isUser) {
        bubble.textContent = m.content;
      } else {
        bubble.innerHTML = renderMarkdown(m.content);
      }
      msgContainer.appendChild(bubble);
    });

    temp.appendChild(msgContainer);
    document.body.appendChild(temp);
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(temp, {
      backgroundColor: bgColor, scale: 2, logging: false, windowWidth: 720,
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${username}_${sessionName}_${timeStr.replace(/[:\s]/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.body.removeChild(temp);
  } catch (e) {
    alert('导出失败：' + e.message);
    console.error(e);
  } finally {
    document.body.removeChild(loading);
  }
}

async function createUser() {
  const name = prompt('新用户名字（1-20 位字母/数字/汉字）：');
  if (!name) return;
  try {
    const res = await fetch('/users/new', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({user: name.trim()})
    });
    const data = await res.json();
    if (data.ok) { alert('✅ 用户已创建'); await switchUser(name.trim()); await loadUsers(); }
    else alert('创建失败：' + (data.error || '未知错误'));
  } catch (e) { alert('创建失败：' + e.message); }
}

async function renameCurrentUser() {
  if (currentUser === 'default') { alert('default 用户不能重命名'); return; }
  const newName = prompt('新名字（1-20 位字母/数字/汉字）：', currentUser);
  if (!newName || newName.trim() === currentUser) return;
  try {
    const res = await fetch('/users/rename', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({old: currentUser, new: newName.trim()})
    });
    const data = await res.json();
    if (data.ok) {
      currentUser = newName.trim();
      document.getElementById('userLabel').textContent = currentUser;
      alert('✅ 已重命名');
      await reloadAll(); await loadUsers();
    } else alert('重命名失败：' + (data.error || '未知错误'));
  } catch (e) { alert('重命名失败：' + e.message); }
}

async function deleteSelf(name) {
  if (name === 'default') { alert('default 用户不能删除'); return; }
  if (!confirm(`确定删除当前用户「${name}」？\n所有会话和设置都会被删除，不可恢复。\n删除后将自动切换到 default 用户。`)) return;
  try {
    const res = await fetch('/users/delete', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({user: name})
    });
    const data = await res.json();
    if (data.ok) {
      alert('✅ 已删除，切换到 default 用户');
      currentUser = 'default';
      document.getElementById('userLabel').textContent = 'default';
      await reloadAll(); await loadUsers();
    } else alert('删除失败：' + (data.error || '未知错误'));
  } catch (e) { alert('删除失败：' + e.message); }
}

async function reloadAll() {
  let s = {};
  try { s = await (await fetch('/settings')).json(); } catch (e) {}
  applyTheme(s.theme || 'dark');
  document.getElementById('web').checked = !!s.force_web;
  document.getElementById('autoSpeak').checked = !!s.auto_speak;
  autoSpeak = !!s.auto_speak;
  loadTemplates(s.templates);
  loadParamsFromSettings(s);
  currentSid = null;
  chat.innerHTML = '';
  await loadSessions();
  const list = await (await fetch('/sessions')).json();
  if (s.last_session && list.find(x => x.id === s.last_session)) await switchSession(s.last_session);
  else if (list.length > 0) await switchSession(list[0].id);
  else await newSession();
  if (s.current_model) {
    for (const opt of modelSelect.options) {
      if (opt.value === s.current_model) { modelSelect.value = s.current_model; break; }
    }
  }
}

async function loadSessions() {
  const res = await fetch('/sessions');
  const list = await res.json();
    // v8.5: 按手动排序调整（有 order 才排）
  const _order = JSON.parse(localStorage.getItem('sessionOrder') || '[]');
  if (_order.length) {
    const _map = {};
    _order.forEach((id, i) => _map[id] = i);
    list.sort((a, b) => {
      const ia = _map[a.id] ?? 9999;
      const ib = _map[b.id] ?? 9999;
      return ia - ib;
    });
  }
  window._sessionCache = list;
  const ul = document.getElementById('sessionList');
  ul.innerHTML = '';

  const groups = {
    '📌 置顶': [],
    '今天': [],
    '昨天': [],
    '近 7 天': [],
    '更早': [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  list.forEach(s => {
    if (s.pinned) {
      groups['📌 置顶'].push(s);
      return;
    }
    let t = null;
    try { t = new Date(s.time.replace(' ', 'T')); } catch (e) {}
    if (!t || isNaN(t)) { groups['更早'].push(s); return; }

    if (t >= today) groups['今天'].push(s);
    else if (t >= yesterday) groups['昨天'].push(s);
    else if (t >= weekAgo) groups['近 7 天'].push(s);
    else groups['更早'].push(s);
  });

  const collapsed = JSON.parse(localStorage.getItem('collapsedGroups') || '{}');

  Object.keys(groups).forEach(groupName => {
    const items = groups[groupName];
    if (items.length === 0) return;

    const header = document.createElement('li');
    header.className = 'group-header' + (collapsed[groupName] ? ' collapsed' : '');
    header.style.listStyle = 'none';
    header.innerHTML = `<span class="arrow">▼</span> ${groupName} <span class="group-count">${items.length}</span>`;
    header.onclick = () => {
      collapsed[groupName] = !collapsed[groupName];
      localStorage.setItem('collapsedGroups', JSON.stringify(collapsed));
      loadSessions();
    };
    ul.appendChild(header);

    if (collapsed[groupName]) return;

    items.forEach(s => {
      const li = document.createElement('li');
      const pinned = s.pinned ? true : false;
      li.className = (s.id === currentSid ? 'active' : '') + (pinned ? ' pinned' : '');
      li.textContent = s.name;
      li.title = '双击重命名 · 右键置顶';

      if (pinned) {
        const pin = document.createElement('span');
        pin.className = 'pin';
        pin.textContent = '📌';
        pin.title = '取消置顶';
        pin.onclick = (e) => { e.stopPropagation(); togglePin(s.id); };
        li.appendChild(pin);
      }

      li.ondblclick = (e) => {
        e.stopPropagation();
        const newName = prompt('重命名对话：', s.name);
        if (newName && newName.trim()) renameSession(s.id, newName.trim());
      };

      const del = document.createElement('span');
      del.className = 'del';
      del.textContent = '×';
      del.onclick = (e) => delSession(s.id, e);
      li.appendChild(del);

      li.onclick = () => switchSession(s.id);
      ul.appendChild(li);
    });
  });

  if (ul.children.length === 0) {
    const li = document.createElement('li');
    li.textContent = '还没有对话';
    li.style.color = 'var(--text-muted)';
    li.style.cursor = 'default';
    li.style.textAlign = 'center';
    ul.appendChild(li);
  }
}

async function togglePin(sid) {
  await fetch(`/sessions/${sid}/pin`, {method: 'POST'});
  await loadSessions();
}

async function clearSessions() {
  if (!confirm('清空所有未置顶的对话？置顶的会保留。')) return;
  try {
    const res = await fetch('/sessions/clear', {method: 'POST'});
    const data = await res.json();
    alert(`✅ 已清空，保留了 ${data.kept} 个置顶对话`);
    await loadSessions();
    const list = await (await fetch('/sessions')).json();
    if (list.length > 0) await switchSession(list[0].id);
    else await newSession();
  } catch (e) { alert('清空失败：' + e.message); }
}

async function newSession() {
  const res = await fetch('/sessions/new', {method: 'POST'});
  const data = await res.json();
  currentSid = data.id;
  chat.innerHTML = '';
  msgCounter = 0;
  addMsg('你好！我是墨墨。有什么想问的？', 'ai');
  await loadSessions();
}

async function switchSession(sid, highlightText = null) {
  currentSid = sid;
  const res = await fetch(`/sessions/${sid}`);
  const hist = await res.json();
  chat.innerHTML = '';
  msgCounter = 0;
  if (hist.length === 0) {
    addMsg('你好！我是墨墨。有什么想问的？', 'ai');
  } else {
    hist.forEach(m => addMsg(m.content, m.role === 'user' ? 'user' : 'ai', null, m.ts || null));
    applyCollapseAll();
  }
  await loadSessions();
  saveSetting('last_session', sid);

  if (highlightText) {
    setTimeout(() => {
      const allMsgs = chat.querySelectorAll('.msg');
      let found = false;
      allMsgs.forEach(m => {
        if (!found && m.textContent.includes(highlightText)) {
          m.classList.add('highlight');
          m.scrollIntoView({behavior: 'smooth', block: 'center'});
          setTimeout(() => m.classList.remove('highlight'), 2000);
          found = true;
        }
      });
    }, 300);
  }
}

async function delSession(sid, e) {
  e.stopPropagation();
  if (!confirm('删除这条对话？')) return;
  await fetch(`/sessions/${sid}`, {method: 'DELETE'});
  if (sid === currentSid) await newSession();
  else await loadSessions();
}

async function renameSession(sid, name) {
  await fetch(`/sessions/${sid}/rename`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name})
  });
  await loadSessions();
}

function exportCurrent() {
  if (!currentSid) { alert('当前没有对话可导出'); return; }
  window.location.href = `/sessions/${currentSid}/export`;
}

async function switchToDefault() {
  if (currentUser === 'default' && !isSpectator) return;
  try {
    const res = await fetch('/users/switch_to_default', {method: 'POST'});
    const data = await res.json();
    if (!data.ok) { alert('切换失败'); return; }
    await reloadAll();
    await loadUsers();
  } catch (e) { alert('切换失败：' + e.message); }
}

// ==================== 导出对话为图片 ====================
async function exportAsImage() {
  if (!currentSid) { alert('当前没有对话可导出'); return; }
  const messages = chat.querySelectorAll('.msg-row');
  if (messages.length === 0) { alert('对话是空的'); return; }

  const loading = document.createElement('div');
  loading.textContent = '📸 正在生成图片...';
  loading.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: var(--bg-header); color: var(--text); padding: 16px 32px;
    border-radius: 12px; border: 1px solid var(--border);
    box-shadow: 0 8px 40px rgba(0,0,0,0.4); z-index: 99999; font-size: 14px;
  `;
  document.body.appendChild(loading);

  try {
    const temp = document.createElement('div');
    const sessionName = await getSessionName(currentSid);
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const isLight = document.body.classList.contains('light');
    const bgColor = isLight ? '#f5f5f7' : '#1e1e2e';
    const textColor = isLight ? '#202124' : '#e0e0e0';
    const borderColor = isLight ? '#c0c0c8' : '#3a3a50';
    const accentColor = isLight ? '#1a73e8' : '#4a6cf7';

    temp.style.cssText = `
      position: fixed; left: -99999px; top: 0;
      width: 720px; padding: 30px;
      background: ${bgColor}; color: ${textColor};
      font-family: -apple-system, "PingFang SC", sans-serif;
      box-sizing: border-box;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding-bottom: 20px; margin-bottom: 20px;
      border-bottom: 2px solid ${accentColor};
    `;
    header.innerHTML = `
      <div style="font-size: 20px; font-weight: 700; color: ${accentColor};">墨墨AI</div>
      <div style="font-size: 14px; margin-top: 6px; color: ${textColor};">${escapeHtml(sessionName)}</div>
      <div style="font-size: 12px; margin-top: 4px; opacity: 0.6;">导出于 ${timeStr}</div>
    `;
    temp.appendChild(header);

    const msgContainer = document.createElement('div');
    msgContainer.style.cssText = `display: flex; flex-direction: column; gap: 16px;`;

    messages.forEach(row => {
      const isUser = row.classList.contains('user');
      const msgDiv = row.querySelector('.msg');
      const msgText = msgDiv.innerHTML;

      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        line-height: 1.6;
        word-break: break-word;
        font-size: 14px;
        ${isUser
          ? `align-self: flex-end; background: ${accentColor}; color: #fff;`
          : `align-self: flex-start; background: ${isLight ? '#ffffff' : '#2a2a3e'}; border: 1px solid ${borderColor};`}
      `;

      const clone = document.createElement('div');
      clone.innerHTML = msgText;
      clone.querySelectorAll('span').forEach(span => {
        const t = span.textContent;
        if (t === '🔊' || t === '🔄' || t === '📋' || t === '✏️' || t === '✅') span.remove();
      });
      clone.querySelectorAll('.tag, .msg-time, .code-copy-btn').forEach(t => t.remove());

      bubble.innerHTML = clone.innerHTML;
      msgContainer.appendChild(bubble);
    });

    temp.appendChild(msgContainer);
    document.body.appendChild(temp);
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(temp, {
      backgroundColor: bgColor, scale: 2, logging: false, windowWidth: 720,
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sessionName}_${timeStr.replace(/[:\s]/g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.body.removeChild(temp);
  } catch (e) {
    alert('导出失败：' + e.message);
    console.error(e);
  } finally {
    document.body.removeChild(loading);
  }
}

async function getSessionName(sid) {
  try {
    const res = await fetch('/sessions');
    const list = await res.json();
    const s = list.find(x => x.id === sid);
    return s ? s.name : '对话';
  } catch (e) { return '对话'; }
}

// ==================== RAG ====================
async function reloadRag(e) {
  const btn = e.target;
  btn.textContent = '⏳ 重载中...'; btn.disabled = true;
  try {
    const res = await fetch('/rag/reload', {method: 'POST'});
    const data = await res.json();
    alert(`✅ 知识库已重载\n共 ${data.chunks} 个片段`);
    await updateRagStatus();
  } catch (err) { alert('重载失败：' + err.message); }
  finally { btn.textContent = '🔄 重载知识库'; btn.disabled = false; }
}

async function updateRagStatus() {
  try {
    const res = await fetch('/rag/status');
    const data = await res.json();
    const files = data.files ?? 0;
    const chunks = data.chunks ?? 0;
    document.getElementById('ragStatus').textContent = `📚 ${files} 个文件 · ${chunks} 个片段`;
  } catch (e) {
    document.getElementById('ragStatus').textContent = '📚 知识库未加载';
  }
}

async function resetChat() {
  if (!confirm('清空当前对话记忆？')) return;
  await fetch('/reset', {method: 'POST'});
  await newSession();
}

// ==================== 输入框（多行 + 自动增高） ====================
function autoGrow() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
}
input.addEventListener('input', autoGrow);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault(); send();
  }
});

// ==================== 全局快捷键 ====================
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey;
  if (mod && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newSession(); return; }
  if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault(); document.getElementById('searchBox').focus(); return;
  }
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault(); exportCurrent(); return;
  }
  if (mod && e.key === 'Enter') { e.preventDefault(); send(); return; }
  if (e.key === 'Escape') {
    // 优先关弹窗
    const sm = document.getElementById('shortcutModal');
    if (sm && sm.classList.contains('show')) { sm.classList.remove('show'); return; }
    const sp = document.getElementById('statusPanel');
    if (sp && sp.style.display !== 'none') { sp.style.display = 'none'; return; }
    if (currentAbortController) { stopGeneration(); return; }
  }
  const tag = document.activeElement.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';

  // ? 打开快捷键面板
  if (e.key === '?' && !typing) {
    e.preventDefault();
    toggleShortcutPanel();
    return;
  }

  if (e.key === '/' && !typing) {
    e.preventDefault(); document.getElementById('searchBox').focus(); return;
  }

  if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    switchToDefault();
    return;
  }
});

// ==================== 快捷键面板 ====================
function toggleShortcutPanel() {
  const m = document.getElementById('shortcutModal');
  m.classList.toggle('show');
}

// ==================== 系统状态面板 ====================
let statusTimer = null;
function toggleStatusPanel() {
  const p = document.getElementById('statusPanel');
  const showing = p.style.display !== 'none';
  if (showing) {
    p.style.display = 'none';
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
  } else {
    p.style.display = 'block';
    refreshStatus();
    statusTimer = setInterval(refreshStatus, 3000);
  }
}

async function refreshStatus() {
  try {
    const s = await fetch('/api/status').then(r => r.json());
    document.getElementById('stModel').textContent = s.model || '-';
    document.getElementById('stCpu').textContent = (s.cpu_percent ?? '-') + '%';
    document.getElementById('stMem').textContent = s.mem_used_gb != null
      ? `${s.mem_used_gb} / ${s.mem_total_gb} GB (${s.mem_percent}%)` : '-';
    document.getElementById('stProc').textContent = (s.proc_mem_mb ?? '-') + ' MB';
    const up = s.uptime_s || 0;
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
    document.getElementById('stUp').textContent = `${h}h ${m}m`;
  } catch (e) {
    document.getElementById('stModel').textContent = '（后端 /api/status 未实现）';
  }
}

// ==================== 参数滑杆 ====================
const tempSlider = document.getElementById('tempSlider');
const topPSlider = document.getElementById('topPSlider');
const maxTokSlider = document.getElementById('maxTokSlider');
const tempVal = document.getElementById('tempVal');
const topPVal = document.getElementById('topPVal');
const maxTokVal = document.getElementById('maxTokVal');

function loadParamsFromSettings(s) {
  if (s.temperature != null) { tempSlider.value = s.temperature; tempVal.textContent = Number(s.temperature).toFixed(2); }
  if (s.top_p != null) { topPSlider.value = s.top_p; topPVal.textContent = Number(s.top_p).toFixed(2); }
  if (s.max_tokens != null) { maxTokSlider.value = s.max_tokens; maxTokVal.textContent = s.max_tokens; }
}

async function loadParams() {
  try {
    const s = await (await fetch('/settings')).json();
    loadParamsFromSettings(s);
  } catch (e) {}
}

function bindSlider(slider, valEl, key, fmt) {
  slider.addEventListener('input', () => { valEl.textContent = fmt(slider.value); });
  slider.addEventListener('change', () => { saveSetting(key, parseFloat(slider.value)); });
}
bindSlider(tempSlider, tempVal, 'temperature', v => Number(v).toFixed(2));
bindSlider(topPSlider, topPVal, 'top_p', v => Number(v).toFixed(2));
bindSlider(maxTokSlider, maxTokVal, 'max_tokens', v => parseInt(v));

    document.addEventListener('DOMContentLoaded', () => {
  const bubble = document.getElementById('transBubble');
  const btn = document.getElementById('doTransBtn');
  const resultEl = document.getElementById('transResult');
  if (!bubble || !btn || !resultEl) {
    console.warn('翻译气泡元素缺失，翻译功能未启用');
    return;
  }

  document.addEventListener('mouseup', e => {
    if (bubble.contains(e.target)) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      bubble.style.display = 'none';
      return;
    }
    const text = (sel.toString() || '').trim();
    if (!text || text.length < 2 || text.length > 800) {
      if (!bubble.contains(e.target)) bubble.style.display = 'none';
      return;
    }
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType !== 1) node = node.parentElement;
    if (!node || !node.closest('.msg')) {
      bubble.style.display = 'none';
      return;
    }
    const rect = range.getBoundingClientRect();
    bubble.style.display = 'block';
    bubble.style.left = Math.min(rect.left, window.innerWidth - 380) + 'px';
    bubble.style.top  = Math.min(rect.bottom + 8, window.innerHeight - 200) + 'px';
    bubble.dataset.text = text;
    resultEl.textContent = '';
  });

  btn.addEventListener('click', async () => {
    const text = bubble.dataset.text;
    if (!text) return;
    resultEl.textContent = '翻译中…';
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text})
      }).then(r => r.json());
      resultEl.textContent = r.result || '（失败）';
    } catch (e) {
      resultEl.textContent = '翻译失败：' + e.message;
    }
  });
});

// ==================== 启动 ====================
(async () => {
  let s = {};
  try { s = await (await fetch('/settings')).json(); } catch (e) {}
  applyTheme(s.theme || 'dark');
  if (s.force_web) document.getElementById('web').checked = true;
  if (s.auto_speak) { document.getElementById('autoSpeak').checked = true; autoSpeak = true; }
  loadTemplates(s.templates);
  loadParamsFromSettings(s);
  await loadUsers();
  await loadSessions();
  await updateRagStatus();
  const list = await (await fetch('/sessions')).json();
  if (s.last_session && list.find(x => x.id === s.last_session)) await switchSession(s.last_session);
  else if (list.length > 0) await switchSession(list[0].id);
  else await newSession();
  if (s.current_model) {
    for (const opt of modelSelect.options) {
      if (opt.value === s.current_model) { modelSelect.value = s.current_model; break; }
    }
  }
  input.focus();
  autoGrow();
})();

// ==================== v7.3.0 临时对话 ====================
let isTemp = false;
let tempId = null;

function toggleTemp() {
  if (isTemp) exitTemp();
  else enterTemp();
}

function enterTemp() {
  isTemp = true;
  tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  currentSid = null;
  chat.innerHTML = '';
  addMsg('⚡ 临时对话已开启。这次聊天不会保存，刷新或关闭就没了。', 'ai');

  document.getElementById('tempBtn').classList.add('active');
  document.getElementById('tempBtn').textContent = '⚡ 临时对话中…';

  const old = document.getElementById('tempBanner');
  if (old) old.remove();
  const banner = document.createElement('div');
  banner.id = 'tempBanner';
  banner.innerHTML = `
    <span>⚡ 临时对话 · 不会出现在历史记录中，你的消息将不会被保存</span>
    <button onclick="exitTemp()">退出临时</button>
  `;
  document.body.insertBefore(banner, document.body.firstChild);

  document.querySelectorAll('#sidebar .new-btn, #sidebar li').forEach(b => {
    if (b.id !== 'tempBtn') { b.style.pointerEvents = 'none'; b.style.opacity = 0.4; }
  });

  input.focus();
}

async function exitTemp() {
  if (!confirm('退出临时对话？当前内容不会保存。')) return;
  if (tempId) {
    fetch('/temp/clear', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({temp_id: tempId})
    });
  }
  isTemp = false;
  tempId = null;
  document.getElementById('tempBtn').classList.remove('active');
  document.getElementById('tempBtn').textContent = '⚡ 临时对话';
  const b = document.getElementById('tempBanner');
  if (b) b.remove();
  document.querySelectorAll('#sidebar .new-btn, #sidebar li').forEach(b => {
    b.style.pointerEvents = ''; b.style.opacity = '';
  });
  await reloadAll();
}

// ===== 代码块一键复制 =====
function attachCopyButtons(root = document) {
  root.querySelectorAll('pre > code').forEach(code => {
    const pre = code.parentElement;
    if (pre.dataset.copyBound) return;
    pre.dataset.copyBound = '1';
    pre.style.position = 'relative';

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = '📋';
    btn.title = '复制代码';
    btn.onclick = async (ev) => {
      ev.stopPropagation();
      try {
        await navigator.clipboard.writeText(code.innerText);
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
      } catch (e) {
        btn.textContent = '❌';
        setTimeout(() => btn.textContent = '📋', 1500);
      }
    };
    pre.appendChild(btn);
  });
}

const codeObserver = new MutationObserver(muts => {
  muts.forEach(m => {
    m.addedNodes.forEach(n => {
      if (n.nodeType === 1) attachCopyButtons(n);
    });
  });
});
codeObserver.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => attachCopyButtons());

// ==================== v7.1.0 对话大纲 ====================
const outlineEl = document.getElementById('outline');

function rebuildOutline() {
  if (!outlineEl) return;
  const userRows = chat.querySelectorAll('.msg-row.user');
  if (userRows.length < 2) {
    outlineEl.classList.add('empty');
    outlineEl.innerHTML = '';
    return;
  }
  outlineEl.classList.remove('empty');
  outlineEl.innerHTML = '';

  userRows.forEach((row, idx) => {
    const msg = row.querySelector('.msg.user');
    if (!msg) return;

    const clone = msg.cloneNode(true);
    clone.querySelectorAll('.msg-time, .copy-btn, .tag').forEach(n => n.remove());
    clone.querySelectorAll('span').forEach(s => {
      const t = (s.textContent || '').trim();
      if (t === '✏️' || t === '📋' || t === '✅') s.remove();
    });
    let text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text) text = '（空消息）';
    const short = text.length > 20 ? safeStr(text).slice(0, 20) + '…' : text;

    const item = document.createElement('div');
    item.className = 'outline-item';
    item.textContent = short;
    item.title = text;
    item.dataset.idx = idx;
    item.onclick = () => {
      row.scrollIntoView({behavior: 'smooth', block: 'start'});
    };
    outlineEl.appendChild(item);
  });
}

let outlineRaf = null;
function updateOutlineActive() {
  if (!outlineEl || outlineEl.classList.contains('empty')) return;
  const userRows = chat.querySelectorAll('.msg-row.user');
  if (userRows.length < 2) return;

  const chatRect = chat.getBoundingClientRect();
  let bestIdx = 0;
  let bestDist = Infinity;
  userRows.forEach((row, idx) => {
    const r = row.getBoundingClientRect();
    if (r.top - chatRect.top <= 80) {
      const d = Math.abs(r.top - chatRect.top - 40);
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    }
  });

  const items = outlineEl.querySelectorAll('.outline-item');
  items.forEach((it, i) => it.classList.toggle('active', i === bestIdx));

  const activeItem = items[bestIdx];
  if (activeItem) {
    const or = outlineEl.getBoundingClientRect();
    const ar = activeItem.getBoundingClientRect();
    if (ar.top < or.top || ar.bottom > or.bottom) {
      activeItem.scrollIntoView({block: 'nearest'});
    }
  }
}

chat.addEventListener('scroll', () => {
  if (outlineRaf) return;
  outlineRaf = requestAnimationFrame(() => {
    outlineRaf = null;
    updateOutlineActive();
  });
});

// chat 变化（新消息 / 切会话）后自动重建
let outlineRebuildTimer = null;
const outlineObserver = new MutationObserver(() => {
  clearTimeout(outlineRebuildTimer);
  outlineRebuildTimer = setTimeout(() => {
    rebuildOutline();
    updateOutlineActive();
  }, 80);
});
outlineObserver.observe(chat, { childList: true });

    // ==================== v7.1.0 文件夹 ====================
let foldersCache = [];
const collapsedFolders = JSON.parse(localStorage.getItem('collapsedFolders') || '{}');

async function loadFolders() {
  try {
    const r = await fetch('/api/folders').then(r => r.json());
    foldersCache = r.folders || [];
    renderFolders();
  } catch (e) { console.error(e); }
}

function renderFolders() {
  const ul = document.getElementById('folderList');
  if (!ul) return;
  ul.innerHTML = '';
  if (foldersCache.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--text-muted);font-size:11px;padding:4px 10px;';
    li.textContent = '（暂无文件夹）';
    ul.appendChild(li);
    return;
  }

  foldersCache.forEach(f => {
    // 文件夹头
    const header = document.createElement('li');
    header.className = 'folder-item' + (collapsedFolders[f.id] ? ' collapsed' : '');
    header.innerHTML = `
      <span class="folder-name">${collapsedFolders[f.id] ? '▶' : '▼'} 📁 ${escapeHtml(f.name)}</span>
      <span class="folder-count">${(f.sessions || []).length}</span>
      <span class="folder-del" title="删除文件夹">×</span>
    `;
    header.querySelector('.folder-name').onclick = (e) => {
      e.stopPropagation();
      collapsedFolders[f.id] = !collapsedFolders[f.id];
      localStorage.setItem('collapsedFolders', JSON.stringify(collapsedFolders));
      renderFolders();
    };
    header.querySelector('.folder-del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`删除文件夹「${f.name}」？\n里面的对话会回到主列表，不会被删。`)) return;
      await fetch(`/api/folders/${f.id}/delete`, {method: 'POST'});
      await loadFolders();
      await loadSessions();
    };
    ul.appendChild(header);

    // 里面的会话
    const sub = document.createElement('ul');
    sub.className = 'folder-sessions';
    const allSessions = window._sessionCache || [];
    (f.sessions || []).forEach(sid => {
      const s = allSessions.find(x => x.id === sid);
      if (!s) return;
      const li = document.createElement('li');
      li.className = (sid === currentSid ? 'active' : '');
      li.textContent = s.name;
      li.title = s.name;
      li.onclick = () => switchSession(sid);
      const del = document.createElement('span');
      del.className = 'del'; del.textContent = '×';
      del.onclick = (e) => { e.stopPropagation(); delSession(sid, e); };
      li.appendChild(del);
      sub.appendChild(li);
    });
    ul.appendChild(sub);
  });
}

async function newFolder() {
  const name = prompt('文件夹名字：');
  if (!name || !name.trim()) return;
  const r = await fetch('/api/folders/new', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: name.trim()})
  }).then(r => r.json());
  if (r.ok) loadFolders();
  else alert(r.error || '创建失败');
}

// ========== 会话右键菜单 ==========
const ctxMenu = document.createElement('div');
ctxMenu.id = 'ctxMenu';
document.body.appendChild(ctxMenu);

function showCtxMenu(x, y, sid) {
  ctxMenu.innerHTML = '';
  ctxMenu.style.display = 'block';
  ctxMenu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  ctxMenu.style.top = Math.min(y, window.innerHeight - 260) + 'px';

  const pinItem = document.createElement('div');
  pinItem.className = 'ctx-item';
  pinItem.textContent = '📌 置顶 / 取消置顶';
  pinItem.onclick = async () => { hideCtxMenu(); await togglePin(sid); };
  ctxMenu.appendChild(pinItem);

    const upItem = document.createElement('div');
  upItem.className = 'ctx-item';
  upItem.textContent = '⬆️ 上移';
  upItem.onclick = () => { hideCtxMenu(); moveSession(sid, -1); };
  ctxMenu.appendChild(upItem);

  const downItem = document.createElement('div');
  downItem.className = 'ctx-item';
  downItem.textContent = '⬇️ 下移';
  downItem.onclick = () => { hideCtxMenu(); moveSession(sid, 1); };
  ctxMenu.appendChild(downItem);

  const sub = document.createElement('div');
  sub.className = 'ctx-sub';
  sub.textContent = '📁 移到文件夹';
  ctxMenu.appendChild(sub);

  // 移出
  const noneItem = document.createElement('div');
  noneItem.className = 'ctx-folder';
  noneItem.textContent = '— 移出文件夹';
  noneItem.onclick = async () => {
    hideCtxMenu();
    await fetch('/api/folders/move', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sid, fid: null})
    });
    await loadFolders();
  };
  ctxMenu.appendChild(noneItem);

  if (foldersCache.length === 0) {
    const e = document.createElement('div');
    e.className = 'ctx-folder';
    e.style.color = 'var(--text-muted)';
    e.textContent = '（还没有文件夹）';
    ctxMenu.appendChild(e);
  } else {
    foldersCache.forEach(f => {
      const it = document.createElement('div');
      it.className = 'ctx-folder';
      it.textContent = '📁 ' + f.name;
      it.onclick = async () => {
        hideCtxMenu();
        await fetch('/api/folders/move', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({sid, fid: f.id})
        });
        await loadFolders();
        await loadSessions();
      };
      ctxMenu.appendChild(it);
    });
  }
}

function hideCtxMenu() { ctxMenu.style.display = 'none'; }
document.addEventListener('click', hideCtxMenu);
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('#sessionList li')) return;
  const li = e.target.closest('#sessionList li');
  if (!li || li.classList.contains('group-header')) return;
  // 从 li 反查 sid
  const name = li.textContent.replace(/[📌×]/g, '').trim();
  const s = (window._sessionCache || []).find(x => x.name === name);
  if (!s) return;
  e.preventDefault();
  showCtxMenu(e.clientX, e.clientY, s.id);
});

    // ==================== v7.4.0 回到底部 ====================
(function initScrollBottom() {
  const btn = document.createElement('button');
  btn.id = 'scrollBottomBtn';
  btn.textContent = '↓';
  btn.title = '回到底部';

  // 挂到 main 里（main 已 position:relative）
  const main = document.querySelector('main');
  if (!main) return;
  main.appendChild(btn);

  btn.onclick = () => {
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
  };

  function updateBtn() {
    const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    btn.classList.toggle('show', !atBottom);
  }

  chat.addEventListener('scroll', updateBtn);
  // 新消息进来后也检查一下
  const ob = new MutationObserver(updateBtn);
  ob.observe(chat, { childList: true });
  updateBtn();
})();

    // ==================== v7.4.0 长消息折叠 ====================
const COLLAPSE_HEIGHT = 420;

function applyCollapse(msgDiv) {
  // 已经是折叠态就别重复处理
  if (msgDiv.dataset.collapseChecked === '1') return;
  // 展开中/流式中跳过
  if (msgDiv.querySelector('.msg-time') === null) return;
  msgDiv.dataset.collapseChecked = '1';

  // 临时去掉限制，量真实高度
  const wasCollapsed = msgDiv.classList.contains('collapsible');
  if (wasCollapsed) msgDiv.classList.remove('collapsible', 'expanded');

  const realHeight = msgDiv.scrollHeight;
  if (realHeight <= COLLAPSE_HEIGHT + 40) return;

  msgDiv.classList.add('collapsible');

  const btn = document.createElement('button');
  btn.className = 'expand-btn';
  btn.textContent = '展开全部 ▼';
  btn.onclick = (e) => {
    e.stopPropagation();
    const expanded = msgDiv.classList.toggle('expanded');
    btn.textContent = expanded ? '收起 ▲' : '展开全部 ▼';
  };
  msgDiv.appendChild(btn);
}

// 扫描所有 AI 消息（切换会话 / 重新渲染时调用）
function applyCollapseAll() {
  chat.querySelectorAll('.msg.ai').forEach(applyCollapse);
}

// 导出后给已有代码调用：切换会话渲染完调一次
window.applyCollapseAll = applyCollapseAll;

    // ==================== v7.5.0 语音通话模式 ====================
let callMode = false;
let callHangup = false;
let callRecognition = null;
let callBuffer = '';
let callSilenceTimer = null;
let callSending = false;

function toggleCall() {
  if (callMode) exitCall();
  else enterCall();
}

function enterCall() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('当前浏览器不支持语音识别，建议用 Chrome'); return; }
  if (!('speechSynthesis' in window)) { alert('当前浏览器不支持语音朗读'); return; }

  callMode = true;
  callBuffer = '';
  callSending = false;

  document.getElementById('callBtn').classList.add('active');

  let bar = document.getElementById('callBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'callBar';
    bar.innerHTML = `
      <span class="call-status" id="callStatus">🎙️ 正在听…</span>
      <span class="call-text" id="callText"></span>
      <button class="call-hangup" onclick="exitCall()">挂断</button>
    `;
    document.body.appendChild(bar);
  }
  bar.style.display = 'flex';

  initCallRecognition();
  startCallListen();
}

function exitCall() {
  callMode = false;
  callHangup = true;                    // ← 加这行
  callBuffer = '';
  callSending = false;
  clearTimeout(callSilenceTimer);
  stopGeneration();

  if (callRecognition) { try { callRecognition.stop(); } catch (e) {} }
  window.speechSynthesis.cancel();

  const bar = document.getElementById('callBar');
  if (bar) bar.style.display = 'none';
  document.getElementById('callBtn').classList.remove('active');

  setTimeout(() => { callHangup = false; }, 500);  // ← 半秒后复位
}

function initCallRecognition() {
  if (callRecognition) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  callRecognition = new SR();
  callRecognition.lang = 'zh-CN';
  callRecognition.continuous = true;
  callRecognition.interimResults = true;

  callRecognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) callBuffer += t;
      else interim += t;
    }
    const display = (callBuffer + interim).trim();
    const textEl = document.getElementById('callText');
    if (textEl) textEl.textContent = display ? `「${display}」` : '';

    clearTimeout(callSilenceTimer);
    callSilenceTimer = setTimeout(onCallSilence, 1500);
  };

  callRecognition.onend = () => {
    if (callMode && !callSending) {
      setTimeout(() => { if (callMode && !callSending) startCallListen(); }, 200);
    }
  };

  callRecognition.onerror = (e) => console.warn('通话识别错误:', e.error);
}

function startCallListen() {
  if (!callMode || callSending) return;
  try { callRecognition.start(); } catch (e) {}
  const s = document.getElementById('callStatus');
  if (s) s.textContent = '🎙️ 正在听…';
}

function stopCallListen() {
  if (callRecognition) { try { callRecognition.stop(); } catch (e) {} }
}

async function onCallSilence() {
  const text = callBuffer.trim();
  if (!text || callSending) return;
  callBuffer = '';
  callSending = true;

  document.getElementById('callStatus').textContent = '💭 思考中…';
  document.getElementById('callText').textContent = '';
  stopCallListen();

  const beforeCount = chat.querySelectorAll('.msg.ai').length;
  input.value = text;

  try { await send(); } catch (e) { console.error(e); }

  const afterMsgs = chat.querySelectorAll('.msg.ai');
  if (afterMsgs.length === beforeCount) {
    callSending = false;
    if (callMode) startCallListen();
    return;
  }

  // 提取最后一条 AI 消息纯文本
  const lastMsg = afterMsgs[afterMsgs.length - 1];
  const clone = lastMsg.cloneNode(true);
  clone.querySelectorAll('.msg-time, .copy-btn, .expand-btn, .tag').forEach(n => n.remove());
  clone.querySelectorAll('span').forEach(s => {
    const t = (s.textContent || '').trim();
    if (['🔊','🔄','📋','✏️','✅'].includes(t)) s.remove();
  });
  const replyText = clone.textContent.trim();

  document.getElementById('callStatus').textContent = '🔊 回复中…';
  speakCall(replyText, () => {
    callSending = false;
    if (callMode) startCallListen();
  });
}

function speakCall(text, onDone) {
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/[#*_>`\-]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[🔊🔄📋✏️✅↓◀📖]/g, '')
    .trim();
  if (!clean) { onDone && onDone(); return; }

  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'zh-CN';
  u.rate = 1.1;
  u.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find(v => v.lang === 'zh-CN' || v.lang === 'zh_CN');
  if (zh) u.voice = zh;
  u.onend = () => onDone && onDone();
  u.onerror = () => onDone && onDone();
  window.speechSynthesis.speak(u);
}

    // ==================== v7.5.0 图片灯箱 ====================
(function initLightbox() {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `
      <button class="lb-close" onclick="closeLightbox()">✕</button>
      <img id="lbImg" src="" alt="">
      <div class="lb-hint">点击背景或按 Esc 关闭 · 滚轮缩放</div>
    `;
    document.body.appendChild(lb);
  }

  const lbImg = document.getElementById('lbImg');

  function openLightbox(src) {
    lbImg.src = src;
    lbImg.style.transform = 'scale(1)';
    lb.classList.add('show');
  }

  window.closeLightbox = function () {
    lb.classList.remove('show');
    lbImg.src = '';
  };

  // 点空白处关闭
  lb.addEventListener('click', e => {
    if (e.target === lb) closeLightbox();
  });

  // Esc 关闭
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lb.classList.contains('show')) {
      closeLightbox();
    }
  });

  // 滚轮缩放
  let lbScale = 1;
  lb.addEventListener('wheel', e => {
    if (!lb.classList.contains('show')) return;
    e.preventDefault();
    lbScale += e.deltaY > 0 ? -0.1 : 0.1;
    lbScale = Math.max(0.3, Math.min(5, lbScale));
    lbImg.style.transform = `scale(${lbScale})`;
  }, { passive: false });

  // 点击消息里的图片
  document.addEventListener('click', e => {
    const img = e.target.closest('.msg img');
    if (!img) return;
    // 排除表情之类的小图
    if (img.naturalWidth < 80) return;
    e.preventDefault();
    lbScale = 1;
    openLightbox(img.src);
  });
})();

    function renderThinkingMsg(aiDiv, fullText, elapsedMs = 0) {
      const thinkMatch = fullText.match(/<thinking>([\s\S]*?)<\/thinking>/);
      const sec = (elapsedMs / 1000).toFixed(1);

      if (!thinkMatch) {
        // 没有 thinking（比如 3B / 1.5B 走本地），不显示折叠块
        aiDiv.innerHTML = renderMarkdown(fullText);
        highlightCode(aiDiv);
        return false;
      }

      const thinking = thinkMatch[1].trim();
      const answer = fullText.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();

      aiDiv.innerHTML = '';

      const details = document.createElement('details');
      details.className = 'thinking-block';
      details.innerHTML = `
        <summary>✅ 已思考 (${sec}s)</summary>
        <div class="thinking-body">${escapeHtml(thinking)}</div>
      `;
      aiDiv.appendChild(details);

      const answerDiv = document.createElement('div');
      answerDiv.className = 'answer-body';
      answerDiv.innerHTML = renderMarkdown(answer || '（无回答）');
      highlightCode(answerDiv);
      aiDiv.appendChild(answerDiv);

      return true;
    }

    // ==================== v8.0.1 思考开关 ====================
let thinkMode = localStorage.getItem('thinkMode') || 'auto';  // auto / on / off

function toggleThink() {
  const order = ['auto', 'on', 'off'];
  const idx = order.indexOf(thinkMode);
  thinkMode = order[(idx + 1) % order.length];
  localStorage.setItem('thinkMode', thinkMode);
  updateThinkBtn();
}

function updateThinkBtn() {
  const btn = document.getElementById('thinkBtn');
  if (!btn) return;
  btn.classList.remove('on', 'off');
  if (thinkMode === 'on') {
    btn.classList.add('on');
    btn.title = '思考模式：强制开启';
  } else if (thinkMode === 'off') {
    btn.classList.add('off');
    btn.title = '思考模式：关闭';
  } else {
    btn.title = '思考模式：自动（简单问题跳过）';
  }
}

document.addEventListener('DOMContentLoaded', updateThinkBtn);

    // ==================== v8.1.0 代码块全屏 ====================
(function initCodeFullscreen() {
  // 创建全屏容器
  let fs = document.getElementById('codeFullscreen');
  if (!fs) {
    fs = document.createElement('div');
    fs.id = 'codeFullscreen';
    fs.innerHTML = `
      <div class="cf-header">
        <span class="cf-title" id="cfLang">代码</span>
        <button class="cf-close" onclick="closeCodeFullscreen()">✕ 关闭 (Esc)</button>
      </div>
      <pre><code id="cfCode"></code></pre>
    `;
    document.body.appendChild(fs);
  }

  const cfCode = document.getElementById('cfCode');
  const cfLang = document.getElementById('cfLang');

  window.closeCodeFullscreen = function () {
    fs.classList.remove('show');
    cfCode.textContent = '';
  };

  // Esc 关闭
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && fs.classList.contains('show')) {
      closeCodeFullscreen();
    }
  });

  // 给代码块挂全屏按钮
  function attachFullscreenBtns(root = document) {
    root.querySelectorAll('pre > code').forEach(code => {
      const pre = code.parentElement;
      if (pre.dataset.fsBound) return;
      pre.dataset.fsBound = '1';

      const btn = document.createElement('button');
      btn.className = 'code-fullscreen-btn';
      btn.textContent = '⛶';
      btn.title = '全屏查看';
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const lang = code.className.match(/language-(\w+)/);
        cfLang.textContent = lang ? lang[1] : '代码';
        cfCode.textContent = code.innerText;
        cfCode.className = code.className;
        try { hljs.highlightElement(cfCode); } catch (e) {}
        fs.classList.add('show');
      };
      pre.appendChild(btn);
    });
  }

  // 监听流式输出的新代码块
  const ob = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1) attachFullscreenBtns(n);
      });
    });
  });
  ob.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => attachFullscreenBtns());
  attachFullscreenBtns();
})();

    // ==================== v8.1.0 消息时间轴 ====================
(function initTimeline() {
  const track = document.createElement('div');
  track.id = 'timeline-track';
  chat.appendChild(track);
})();

    // ==================== v8.2.0 消息收藏 ====================
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

function saveFavorites() {
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// 消息唯一 ID：sid + 消息在会话里的序号
function makeFavKey(sid, idx) {
  return `${sid}::${idx}`;
}

function isFavorited(sid, idx) {
  return favorites.some(f => f.key === makeFavKey(sid, idx));
}

function toggleFavorite(sid, idx, text, role, btn) {
  const key = makeFavKey(sid, idx);
  const existing = favorites.findIndex(f => f.key === key);
  if (existing >= 0) {
    favorites.splice(existing, 1);
    if (btn) btn.classList.remove('active');
  } else {
    favorites.unshift({
      key,
      sid,
      idx,
      text: (typeof text === 'string' ? text : String(text || '')).slice(0, 200),
      role,
      ts: Date.now() / 1000,
      sessionName: (window._sessionCache || []).find(s => s.id === sid)?.name || '对话'
    });
    if (btn) btn.classList.add('active');
  }
  saveFavorites();
  renderFavorites();
}

function renderFavorites() {
  const ul = document.getElementById('favList');
  const cnt = document.getElementById('favCount');
  if (!ul) return;
  if (cnt) cnt.textContent = favorites.length ? `${favorites.length}` : '';
  ul.innerHTML = '';

  if (favorites.length === 0) {
    const li = document.createElement('li');
    li.className = 'fav-empty';
    li.textContent = '（暂无收藏）';
    ul.appendChild(li);
    return;
  }

  favorites.forEach(f => {
    const li = document.createElement('li');
    const preview = safeStr(f.text).replace(/\s+/g, ' ').slice(0, 30);
    li.textContent = `⭐ ${preview}${f.text.length > 30 ? '…' : ''}`;
    li.title = `${f.sessionName}\n${f.text}`;
    li.onclick = () => jumpToFavorite(f);

    const del = document.createElement('span');
    del.className = 'fav-del';
    del.textContent = '×';
    del.onclick = (e) => {
      e.stopPropagation();
      favorites = favorites.filter(x => x.key !== f.key);
      saveFavorites();
      renderFavorites();
    };
    li.appendChild(del);

    ul.appendChild(li);
  });
}

async function jumpToFavorite(f) {
  if (f.sid !== currentSid) {
    await switchSession(f.sid);
  }
  setTimeout(() => {
    const rows = chat.querySelectorAll('.msg-row');
    const target = rows[f.idx];
    if (target) {
      target.scrollIntoView({behavior: 'smooth', block: 'center'});
      target.querySelector('.msg')?.classList.add('highlight');
      setTimeout(() => target.querySelector('.msg')?.classList.remove('highlight'), 2000);
    }
  }, 400);
}

// 给消息加收藏按钮（在 addMsg / addMsgButtons 里调用）
function attachFavBtn(div, idx, text, role) {
  const btn = document.createElement('span');
  btn.className = 'fav-btn' + (isFavorited(currentSid, idx) ? ' active' : '');
  btn.textContent = '⭐';
  btn.title = '收藏';
  btn.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(currentSid, idx, text, role, btn);
  };
  div.appendChild(btn);
}

// 启动时初始化
document.addEventListener('DOMContentLoaded', renderFavorites);

    // ==================== v8.2.0 消息内搜索 ====================
let msgSearchHits = [];
let msgSearchIdx = -1;

function toggleMsgSearch() {
  const bar = document.getElementById('msgSearchBar');
  if (bar.style.display === 'none') {
    bar.style.display = 'flex';
    document.getElementById('msgSearchInput').focus();
  } else {
    closeMsgSearch();
  }
}

function closeMsgSearch() {
  document.getElementById('msgSearchBar').style.display = 'none';
  document.getElementById('msgSearchInput').value = '';
  clearMsgSearchHits();
  document.getElementById('msgSearchCount').textContent = '0 / 0';
}

function clearMsgSearchHits() {
  chat.querySelectorAll('mark.msg-search-hit').forEach(m => {
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
  msgSearchHits = [];
  msgSearchIdx = -1;
}

function performMsgSearch(query) {
  clearMsgSearchHits();
  if (!query || query.length < 1) {
    document.getElementById('msgSearchCount').textContent = '0 / 0';
    return;
  }

  // 遍历所有消息里的文本节点，替换成 <mark>
  const walker = document.createTreeWalker(
    chat,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentNode.tagName === 'SCRIPT') return NodeFilter.FILTER_REJECT;
        if (node.parentNode.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let n;
  while (n = walker.nextNode()) textNodes.push(n);

  const q = query.toLowerCase();
  textNodes.forEach(node => {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    let idx = 0;
    const pieces = [];
    let lastEnd = 0;
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      if (idx > lastEnd) pieces.push(document.createTextNode(safeStr(text).slice(lastEnd, idx)));
      const mark = document.createElement('mark');
      mark.className = 'msg-search-hit';
      mark.textContent = safeStr(text).slice(idx, idx + q.length);
      pieces.push(mark);
      msgSearchHits.push(mark);
      lastEnd = idx + q.length;
      idx += q.length;
    }
    if (pieces.length) {
      if (lastEnd < text.length) pieces.push(document.createTextNode(safeStr(text).slice(lastEnd)));
      const frag = document.createDocumentFragment();
      pieces.forEach(p => frag.appendChild(p));
      node.parentNode.replaceChild(frag, node);
    }
  });

  updateMsgSearchCount();
  if (msgSearchHits.length > 0) {
    msgSearchIdx = 0;
    focusMsgSearchHit();
  }
}

function updateMsgSearchCount() {
  const el = document.getElementById('msgSearchCount');
  if (msgSearchHits.length === 0) {
    el.textContent = '0 / 0';
  } else {
    el.textContent = `${msgSearchIdx + 1} / ${msgSearchHits.length}`;
  }
}

function focusMsgSearchHit() {
  msgSearchHits.forEach((m, i) => m.classList.toggle('active', i === msgSearchIdx));
  const cur = msgSearchHits[msgSearchIdx];
  if (cur) cur.scrollIntoView({behavior: 'smooth', block: 'center'});
  updateMsgSearchCount();
}

function nextMsgSearchHit() {
  if (msgSearchHits.length === 0) return;
  msgSearchIdx = (msgSearchIdx + 1) % msgSearchHits.length;
  focusMsgSearchHit();
}

function prevMsgSearchHit() {
  if (msgSearchHits.length === 0) return;
  msgSearchIdx = (msgSearchIdx - 1 + msgSearchHits.length) % msgSearchHits.length;
  focusMsgSearchHit();
}

// 事件绑定
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('msgSearchInput');
  if (!inp) return;
  let debounce = null;
  inp.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => performMsgSearch(inp.value.trim()), 200);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prevMsgSearchHit();
      else nextMsgSearchHit();
    } else if (e.key === 'Escape') {
      closeMsgSearch();
    }
  });
  document.getElementById('msgSearchNext').onclick = nextMsgSearchHit;
  document.getElementById('msgSearchPrev').onclick = prevMsgSearchHit;
  document.getElementById('msgSearchClose').onclick = closeMsgSearch;
});

// 全局快捷键 Cmd+Shift+F
document.addEventListener('keydown', e => {
  if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    toggleMsgSearch();
  }
});

    // ==================== v8.2.0 @ 引用消息 ====================
let quoteMenuIdx = -1;
let quoteItems = [];

function openQuoteMenu() {
  const menu = document.getElementById('quoteMenu');
  const rows = Array.from(chat.querySelectorAll('.msg-row'));

  // 只要最近 20 条
  quoteItems = rows.map((row, i) => {
    const isUser = row.classList.contains('user');
    const msgDiv = row.querySelector('.msg');
    const clone = msgDiv.cloneNode(true);

    // 去掉思考块（details.thinking-block）
    clone.querySelectorAll('details.thinking-block').forEach(n => n.remove());
    // 去掉按钮/标签/时间戳
    clone.querySelectorAll('.msg-time, .copy-btn, .fav-btn, .msg-action-btn, .tag, .expand-btn, .code-copy-btn').forEach(n => n.remove());
    // 去掉已存在的引用标记（行首的 > xxx：）
    let text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
    text = safeStr(text).replace(/^>\s*[^：:]{1,10}[：:][^\n]{0,80}\s*/, '').trim();

    return { role: isUser ? '我' : 'AI', text, idx: i };
  })
  .filter(x => x.text && x.text.length > 0)
  .slice(-20);

  if (quoteItems.length === 0) {
    menu.innerHTML = '<div class="qm-empty">还没有消息可引用</div>';
  } else {
    menu.innerHTML = quoteItems.map((q, i) => `
      <div class="qm-item" data-idx="${i}">
        <div class="qm-meta">${q.role}</div>
        <div class="qm-text">${escapeHtml(q.text)}</div>
      </div>
    `).join('');
    menu.querySelectorAll('.qm-item').forEach((el, i) => {
      el.onclick = () => selectQuote(i);
    });
  }

  // 定位在输入框上方
  const rect = input.getBoundingClientRect();
  menu.style.display = 'block';
  menu.style.left = Math.min(rect.left, window.innerWidth - 500) + 'px';
  menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
  menu.style.top = 'auto';

  quoteMenuIdx = -1;
}

function closeQuoteMenu() {
  document.getElementById('quoteMenu').style.display = 'none';
  quoteMenuIdx = -1;
}

function selectQuote(i) {
  const q = quoteItems[i];
  if (!q) return;
  const quote = `> ${q.role}：${q.text}\n\n`;
  const cur = input.value;
  // 移除光标前的 @
  const withoutAt = cur.replace(/@[^@]*$/, '');
  input.value = quote + withoutAt;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  autoGrow();
  closeQuoteMenu();
}

// 监听输入框：打 @ 时弹菜单
input.addEventListener('keydown', e => {
  const menu = document.getElementById('quoteMenu');
  if (menu.style.display === 'block') {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      quoteMenuIdx = Math.min(quoteMenuIdx + 1, quoteItems.length - 1);
      highlightQuoteItem();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      quoteMenuIdx = Math.max(quoteMenuIdx - 1, 0);
      highlightQuoteItem();
      return;
    }
    if (e.key === 'Enter' && quoteMenuIdx >= 0) {
      e.preventDefault();
      selectQuote(quoteMenuIdx);
      return;
    }
    if (e.key === 'Escape') {
      closeQuoteMenu();
      return;
    }
  }
});

input.addEventListener('input', () => {
  const menu = document.getElementById('quoteMenu');
  const val = input.value;
  // 检查光标前是否有 @
  const pos = input.selectionStart;
  const before = val.slice(0, pos);
  if (/@$/.test(before) || /@[^\s]{0,20}$/.test(before)) {
    if (menu.style.display !== 'block') openQuoteMenu();
  } else {
    if (menu.style.display === 'block') closeQuoteMenu();
  }
});

function highlightQuoteItem() {
  const items = document.querySelectorAll('#quoteMenu .qm-item');
  items.forEach((el, i) => el.classList.toggle('active', i === quoteMenuIdx));
  if (items[quoteMenuIdx]) items[quoteMenuIdx].scrollIntoView({block: 'nearest'});
}

// 点击别处关闭
document.addEventListener('click', e => {
  if (!e.target.closest('#quoteMenu') && e.target !== input) {
    closeQuoteMenu();
  }
});

    // ==================== v8.2.0 头像上传 ====================
function changeAvatar() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('图片不能超过 2MB');
      return;
    }

    const fd = new FormData();
    fd.append('avatar', file);

    try {
      const r = await fetch('/api/avatar', {
        method: 'POST',
        body: fd
      }).then(r => r.json());
      if (r.ok) {
        // 加时间戳避免浏览器缓存
        document.querySelectorAll('.msg-row.user .avatar img').forEach(img => {
          img.src = `/static/avatar.png?t=${Date.now()}`;
        });
        alert('✅ 头像已更新');
        location.reload();
      } else {
        alert('上传失败：' + (r.error || '未知错误'));
      }
    } catch (e) {
      alert('上传失败：' + e.message);
    }
  };
  inp.click();
}

    // ==================== v8.3.0 主题色调 ====================
const THEME_COLORS = {
  blue:   { accent: '#4a6cf7', hover: '#5a7cff', light_accent: '#1a73e8', light_hover: '#1668d4' },
  purple: { accent: '#8b5cf6', hover: '#9d70ff', light_accent: '#7c3aed', light_hover: '#6d28d9' },
  green:  { accent: '#10b981', hover: '#34d399', light_accent: '#059669', light_hover: '#047857' },
  orange: { accent: '#f97316', hover: '#fb923c', light_accent: '#ea580c', light_hover: '#c2410c' },
  pink:   { accent: '#ec4899', hover: '#f472b6', light_accent: '#db2777', light_hover: '#be185d' },
  cyan:   { accent: '#06b6d4', hover: '#22d3ee', light_accent: '#0891b2', light_hover: '#0e7490' },
};

function applyAccent(colorKey) {
  const c = THEME_COLORS[colorKey] || THEME_COLORS.blue;
  const isLight = document.body.classList.contains('light');
  document.documentElement.style.setProperty('--accent', isLight ? c.light_accent : c.accent);
  document.documentElement.style.setProperty('--accent-hover', isLight ? c.light_hover : c.hover);

  // 更新选中态
  document.querySelectorAll('.theme-color-picker .color-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === colorKey);
  });
}

function initThemeColor() {
  const saved = localStorage.getItem('themeColor') || 'blue';
  applyAccent(saved);

  document.querySelectorAll('.theme-color-picker .color-dot').forEach(dot => {
    dot.onclick = () => {
      const key = dot.dataset.color;
      localStorage.setItem('themeColor', key);
      applyAccent(key);
    };
  });
}

// 主题切换时同步色调
const _origApplyTheme = applyTheme;
applyTheme = function (theme) {
  _origApplyTheme(theme);
  const saved = localStorage.getItem('themeColor') || 'blue';
  applyAccent(saved);
};

document.addEventListener('DOMContentLoaded', initThemeColor);

    // ==================== v8.3.0 字号调节 ====================
const FONT_SIZES = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
const FONT_LABELS = { small: '小', normal: '标准', large: '大', xlarge: '特大', xxlarge: '超大' };

function applyFontSize(size) {
  if (!FONT_SIZES.includes(size)) size = 'normal';
  document.body.dataset.fontsize = size;
  const label = document.getElementById('fsLabel');
  if (label) label.textContent = FONT_LABELS[size];
  localStorage.setItem('fontSize', size);
}

function changeFontSize(delta) {
  const cur = localStorage.getItem('fontSize') || 'normal';
  const idx = FONT_SIZES.indexOf(cur);
  const next = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
  applyFontSize(FONT_SIZES[next]);
}

document.addEventListener('DOMContentLoaded', () => {
  applyFontSize(localStorage.getItem('fontSize') || 'normal');
});

    // ==================== v8.3.0 PDF 导出 ====================
function exportAsPDF() {
  if (!currentSid) { alert('当前没有对话可导出'); return; }
  const messages = chat.querySelectorAll('.msg-row');
  if (messages.length === 0) { alert('对话是空的'); return; }

  // 展开所有折叠消息
  chat.querySelectorAll('.msg.ai.collapsible').forEach(m => m.classList.add('expanded'));

  // 等一帧让布局稳定
  setTimeout(() => {
    window.print();
  }, 100);
}

    // ==================== v8.3.0 侧边栏图标化 ====================
(function iconizeSidebar() {
  const map = [
    { sel: '#sidebar .new-btn', match: '新对话', icon: '💬', label: '新对话' },
    { sel: '#tempBtn', match: null, icon: '⚡', label: '临时对话' },
    { sel: '#sidebar .new-btn', match: '导出当前', icon: '📥', label: '导出当前对话' },
    { sel: '#sidebar .new-btn', match: '重载知识库', icon: '📚', label: '重载知识库' },
    { sel: '#sidebar .new-btn', match: '修改人设', icon: '⚙️', label: '修改人设' },
    { sel: '#sidebar .new-btn', match: '创作设置', icon: '✍️', label: '创作设置' },
    { sel: '#sidebar .danger-btn', match: null, icon: '🗑️', label: '清空未置顶' },
  ];

  document.querySelectorAll('#sidebar .new-btn, #sidebar .danger-btn').forEach(btn => {
    if (btn.classList.contains('iconized')) return;
    const txt = btn.textContent.trim();
    // 找到匹配的图标
    let icon = '';
    let label = txt;
    for (const m of map) {
      if (m.match && txt.includes(m.match)) { icon = m.icon; label = m.label; break; }
    }
    if (!icon && btn.id === 'tempBtn') { icon = '⚡'; label = '临时对话'; }
    if (!icon) return;

    btn.classList.add('iconized');
    btn.dataset.label = label;
    btn.innerHTML = `<span>${icon}</span><span class="btn-text">${label}</span>`;
  });

  // 给侧边栏折叠按钮加个快捷键 Ctrl+B
  document.addEventListener('keydown', e => {
    // 支持 Ctrl+B 和 Cmd+B
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.getElementById('sidebar').classList.toggle('collapsed-icons');
    }
  });
})();

function saveReactions() {
  localStorage.setItem('reactions', JSON.stringify(reactions));
}

function makeReactKey(sid, text) {
  const str = typeof text === 'string' ? text : String(text || '');
  const hash = str.slice(0, 80).replace(/\s+/g, '_');
  return `${sid}::${hash}`;
}

function attachReactBtns(div, text) {
  const wrap = document.createElement('span');
  wrap.style.display = 'inline-flex';
  wrap.style.gap = '2px';
  wrap.style.marginLeft = '8px';

  ['👍', '👎'].forEach(emoji => {
    const btn = document.createElement('span');
    btn.className = 'react-btn';
    btn.textContent = emoji;
    btn.title = emoji === '👍' ? '有用' : '没用';

    const key = makeReactKey(currentSid, text);
    if (reactions[key] === emoji) btn.classList.add('active');

    btn.onclick = (e) => {
      e.stopPropagation();
      const cur = reactions[key];
      if (cur === emoji) {
        delete reactions[key];
        btn.classList.remove('active');
      } else {
        reactions[key] = emoji;
        const other = emoji === '👍' ? '👎' : '👍';
        wrap.querySelectorAll('.react-btn').forEach(b => {
          if (b.textContent === other) b.classList.remove('active');
        });
        btn.classList.add('active');
      }
      saveReactions();
    };
    wrap.appendChild(btn);
  });
  div.appendChild(wrap);
}

// ==================== 代码块行号 ====================
function attachLineNumbers(root = document) {
  root.querySelectorAll('pre > code').forEach(code => {
    const pre = code.parentElement;
    if (pre.dataset.lnBound) return;
    pre.dataset.lnBound = '1';
    pre.style.position = 'relative';

    const update = () => {
      let old = pre.querySelector('.ln-col');
      if (old) old.remove();
      const text = code.innerText || code.textContent || '';
      const lines = text.split('\n').length;
      // 少于 3 行不加
      if (lines < 3) return;
      const col = document.createElement('div');
      col.className = 'ln-col';
      let nums = '';
      for (let i = 1; i <= lines; i++) nums += i + '\n';
      col.textContent = nums;
      pre.appendChild(col);
    };
    update();

    // 内容变化时重新算（流式输出）
    const ob = new MutationObserver(() => {
      clearTimeout(code._lnTimer);
      code._lnTimer = setTimeout(update, 200);
    });
    ob.observe(code, { childList: true, characterData: true, subtree: true });
  });
}

const lnObserver = new MutationObserver(muts => {
  muts.forEach(m => {
    m.addedNodes.forEach(n => {
      if (n.nodeType === 1) attachLineNumbers(n);
    });
  });
});
lnObserver.observe(document.body, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => attachLineNumbers());

// ==================== 模型快捷面板 ====================
const MODEL_INFO = {
  '3B Q4_K_M':       { desc: '质量优先，日常主力', tags: ['🏆 质量', '🐢 慢'] },
  '1.5B Q4_K_M':     { desc: '速度优先，快速问答', tags: ['⚡ 快', '✅ 好'] },
  '1.5B Q2_K':       { desc: '极速模式，应急使用', tags: ['🚀 极快', '⚠️ 较差'] },
  'Qwen3-1.7B 🧠思考': { desc: 'Ollama 后端，支持真思考', tags: ['🧠 思考', '⚡ 快'] },
  'R1-1.5B 🧠思考':   { desc: 'DeepSeek R1 蒸馏，推理强', tags: ['🧠 思考', '🐢 慢'] },
};

function openModelPanel() {
  const panel = document.getElementById('modelPanel');
  const models = Array.from(modelSelect.options).map(o => o.value);
  const current = modelSelect.value;

  panel.innerHTML = models.map(name => {
    const info = MODEL_INFO[name] || { desc: '', tags: [] };
    const tagsHtml = info.tags.length
      ? `<div class="mp-tags">${info.tags.map(t => `<span class="mp-tag">${t}</span>`).join('')}</div>`
      : '';
    return `
      <div class="mp-item${name === current ? ' active' : ''}" data-model="${escapeHtml(name)}">
        <div class="mp-name">${escapeHtml(name)}</div>
        ${info.desc ? `<div class="mp-desc">${info.desc}</div>` : ''}
        ${tagsHtml}
      </div>
    `;
  }).join('');

  panel.querySelectorAll('.mp-item').forEach(el => {
    el.onclick = () => {
      const name = el.dataset.model;
      modelSelect.value = name;
      modelSelect.dispatchEvent(new Event('change'));
      closeModelPanel();
    };
  });

  // 定位在下拉框上方
  const rect = modelSelect.getBoundingClientRect();
  panel.style.display = 'block';
  panel.style.left = Math.min(rect.left, window.innerWidth - 400) + 'px';
  panel.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
  panel.style.top = 'auto';
}

function closeModelPanel() {
  document.getElementById('modelPanel').style.display = 'none';
}

// 点下拉框时改用面板
modelSelect.addEventListener('mousedown', e => {
  e.preventDefault();
  openModelPanel();
});

// 点别处关闭
document.addEventListener('click', e => {
  const panel = document.getElementById('modelPanel');
  if (!panel.contains(e.target) && e.target !== modelSelect) {
    closeModelPanel();
  }
});

// ==================== 对话分享（导出为独立 HTML） ====================
function shareConversation() {
  if (!currentSid) { alert('当前没有对话可分享'); return; }
  const messages = chat.querySelectorAll('.msg-row');
  if (messages.length === 0) { alert('对话是空的'); return; }

  const sessionName = (window._sessionCache || []).find(s => s.id === currentSid)?.name || '对话';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // 克隆聊天内容，清掉操作按钮
  const clone = chat.cloneNode(true);
  clone.querySelectorAll('#timeline-track, .msg-time, .copy-btn, .fav-btn, .react-btn, .msg-action-btn, .code-copy-btn, .code-fullscreen-btn, .expand-btn, .tag, .ln-col').forEach(n => n.remove());
  clone.querySelectorAll('.msg.ai.collapsible').forEach(m => {
    m.classList.remove('collapsible');
    m.classList.add('expanded');
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>墨墨AI · ${escapeHtml(sessionName)}</title>
<style>
  body {
    font-family: -apple-system, "PingFang SC", sans-serif;
    background: #1e1e2e; color: #e0e0e0;
    max-width: 800px; margin: 0 auto; padding: 40px 20px;
    line-height: 1.6;
  }
  h1 { font-size: 20px; color: #4a6cf7; margin-bottom: 6px; }
  .meta { font-size: 12px; opacity: 0.6; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #3a3a50; }
  #chat { display: flex; flex-direction: column; gap: 16px; }
  .msg-row { display: flex; gap: 10px; align-items: flex-start; }
  .msg-row.user { flex-direction: row-reverse; }
  .avatar { width: 32px; height: 32px; border-radius: 50%; background: #3a3a50; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .msg-row.user .avatar { background: #4a6cf7; color: #fff; }
  .msg-row.ai .avatar { border: 1px solid #4a6cf7; color: #4a6cf7; }
  .msg { max-width: 78%; padding: 10px 14px; border-radius: 12px; word-break: break-word; }
  .msg.user { background: #4a6cf7; color: #fff; }
  .msg.ai { background: #2a2a3e; border: 1px solid #3a3a50; }
  pre { background: #1a1a2a; padding: 12px; border-radius: 8px; overflow-x: auto; }
  code { font-family: "SF Mono", Monaco, monospace; font-size: 13px; }
  .msg.ai code { background: #1a1a2a; padding: 2px 6px; border-radius: 4px; }
  .thinking-block { margin-bottom: 10px; border-left: 2px solid #3a3a50; padding-left: 10px; }
  .thinking-block summary { font-size: 12px; color: #8888aa; cursor: pointer; }
  .thinking-body { font-size: 12px; color: #a0a0c0; padding: 8px 10px; background: #1a1a2a; border-radius: 6px; margin-top: 6px; }
</style>
</head>
<body>
<h1>墨墨AI · ${escapeHtml(sessionName)}</h1>
<div class="meta">导出于 ${timeStr} · Mario Make</div>
<div id="chat">${clone.innerHTML}</div>
</body>
</html>`;

  const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `墨墨_${sessionName}_${timeStr.replace(/[:\s]/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);

  showShareToast('✅ 已导出为 HTML 文件，可直接发给别人');
}

function showShareToast(msg) {
  let toast = document.getElementById('shareToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shareToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== v8.5 会话上移/下移 ====================
function moveSession(sid, dir) {
  const all = window._sessionCache || [];
  const allIds = all.map(s => s.id);
  let order = JSON.parse(localStorage.getItem('sessionOrder') || '[]');

  // 补齐没在 order 里的（新会话默认排最后）
  allIds.forEach(id => { if (!order.includes(id)) order.push(id); });
  // 删掉已不存在的
  order = order.filter(id => allIds.includes(id));

  const idx = order.indexOf(sid);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= order.length) return;

  [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
  localStorage.setItem('sessionOrder', JSON.stringify(order));
  loadSessions();
}

  // ==================== v8.7.0 AI 生图（Pollinations） ====================
const IMAGINE_PATTERNS = [
  /^画(?:一)?(?:张|幅|个|只)?[:：\s]*(.+)$/,
  /^生成(?:一)?(?:张|幅)?图(?:片)?[:：\s]*(.+)$/,
  /^生图[:：\s]+(.+)$/,
  /^绘制[:：\s]*(.+)$/,
  /^来(?:一)?(?:张|幅)[:：\s]*(.+)$/,
];

function parseImagineIntent(text) {
  const t = (text || '').trim();
  if (!t || t.length > 300) return null;
  for (const p of IMAGINE_PATTERNS) {
    const m = t.match(p);
    if (m && m[1]) {
      const prompt = m[1].trim();
      if (prompt.length < 1) return null;
      if (/^(诗|歌|故事|文章|代码|清单|方案|表格|流程图)/.test(prompt)) return null;
      return prompt;
    }
  }
  return null;
}

async function translateForImage(prompt) {
  const res = await fetch('/api/translate_prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt })
  });
  const { en } = await res.json();
  return en;
}

async function doImagine(prompt) {
  // ---------- 1. 建气泡 ----------
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '墨';
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `<div class="img-placeholder">🌐 正在翻译提示词「${escapeHtml(prompt)}」…</div>`;
  row.appendChild(avatar);
  row.appendChild(div);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  // ---------- 2. 翻译成英文 ----------
  let en = prompt;
  try {
    const tRes = await fetch('/api/translate_prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt })
    });
    const tData = await tRes.json();
    if (tData.en && tData.en.trim()) en = tData.en.trim();
  } catch (e) {
    console.warn('翻译失败，用原文', e);
  }

  // ---------- 3. 拼质量词 ----------
  const finalPrompt = en + ', highly detailed, professional photography, soft natural lighting, 8k';

  // ---------- 4. 换回生成中占位 ----------
  div.innerHTML = `<div class="img-placeholder">🎨 正在生成「${escapeHtml(prompt)}」<div class="thinking-dots-anim"><span></span><span></span><span></span></div></div>`;

  // ---------- 5. 构造 URL ----------
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=768&height=768&nologo=true&seed=${seed}&model=z-image-turbo`;

  // ---------- 6. 加载图片 ----------
  const img = new Image();
  img.alt = prompt;

  img.onload = () => {
    div.innerHTML = '';
    const imgEl = document.createElement('img');
    imgEl.src = url;
    imgEl.alt = prompt;
    imgEl.className = 'generated-img';
    imgEl.loading = 'lazy';
    imgEl.title = prompt;
    div.appendChild(imgEl);

    // meta：显示原始中文 + 英文提示词（方便看翻译效果）
    const meta = document.createElement('div');
    meta.className = 'img-meta';
    meta.textContent = `🎨 ${prompt} · seed ${seed}`;
    meta.title = `EN: ${finalPrompt}`;
    div.appendChild(meta);

    // 按钮
    const actions = document.createElement('div');
    actions.className = 'img-actions';

    const rerollBtn = document.createElement('button');
    rerollBtn.textContent = '🎲 换一张';
    rerollBtn.onclick = () => {
      row.remove();
      doImagine(prompt);
    };
    actions.appendChild(rerollBtn);

    const dlBtn = document.createElement('button');
    dlBtn.textContent = '📥 下载';
    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `墨墨_${prompt.slice(0, 20)}_${seed}.jpg`;
      a.target = '_blank';
      a.click();
    };
    actions.appendChild(dlBtn);

    div.appendChild(actions);

    // 时间戳
    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = fmtTime(Date.now() / 1000);
    div.appendChild(timeEl);

    applyCollapse(div);
    chat.scrollTop = chat.scrollHeight;
  };

  img.onerror = () => {
    div.innerHTML = `❌ 生图失败（网络或服务问题）<br>` +
      `<span style="font-size:11px;color:var(--text-muted);">提示词：${escapeHtml(prompt)}<br>EN：${escapeHtml(finalPrompt)}</span>`;
  };

  img.src = url;
  }

  function parseSelfCheck(text) {
  // 如果还在思考中（有 check 标签但没闭合）
  if (text.includes('<check>') && !text.includes('</check>')) {
    const content = text.split('<check>')[1];
    return `<details class="thinking-block" open><summary>🔍 正在二次复核...</summary><div class="thinking-body">${escapeHtml(content)}</div></details>`;
  }
  // 思考完毕
  if (text.includes('<check>') && text.includes('</check>')) {
    const checkMatch = text.match(/<check>([\s\S]*?)<\/check>/);
    const answerMatch = text.includes('<answer>') ? text.match(/<answer>([\s\S]*?)(<\/answer>|$)/) : null;

    let html = '';
    if (checkMatch) {
      // 渲染折叠块（默认收起）
      html += `<details class="thinking-block"><summary>✅ 已进行二次复核</summary><div class="thinking-body">${escapeHtml(checkMatch[1].trim())}</div></details>`;
    }
    if (answerMatch) {
      // 渲染最终答案
      html += renderMarkdown(answerMatch[1]);
    } else {
      // 如果没有 answer 标签，就把剩下的全当答案
      html += renderMarkdown(text.split('</check>')[1] || '');
    }
    return html;
  }
  // 正常渲染
  return renderMarkdown(text);
  }

  // 页面加载时检查
async function checkModelStatus() {
    const res = await fetch('/api/download_status');
    const data = await res.json();

    if (!data.finished && !data.is_downloading) {
        // 没模型，弹窗问用户是否下载
        if (confirm("检测到本地缺少模型文件，是否现在下载？（约 1GB）")) {
            fetch('/api/start_download', { method: 'POST' });
            monitorDownload();
        }
    } else if (data.is_downloading) {
        monitorDownload();
    }
}

function monitorDownload() {
    const interval = setInterval(async () => {
        const res = await fetch('/api/download_status');
        const data = await res.json();

        if (data.is_downloading) {
            const percent = ((data.progress / data.total) * 100).toFixed(1);
            // 这里可以替换成页面上好看的进度条 UI
            console.log(`正在下载模型: ${percent}%`);
        } else if (data.finished) {
            clearInterval(interval);
            alert("模型下载完成！请刷新页面开始对话。");
            location.reload();
        } else if (data.error) {
            clearInterval(interval);
            alert("下载失败: " + data.error);
        }
    }, 1000);
}

// 在页面初始化时调用
// document.addEventListener('DOMContentLoaded', checkModelStatus);