(() => {
  if (document.getElementById('chatToggle')) return;     // tránh nạp 2 lần

  const STORE_KEY = 'comichub_chat';
  const MAX_STORED = 40;
  const SUGGESTIONS = ['Gợi ý truyện hài hước', 'Truyện nào đang hot?', 'Có truyện nào mới cập nhật không?'];
  const WELCOME =
      'Chào bạn! Mình là Comic Meow Bot 🐱. Mình có thể gợi ý truyện, tóm tắt nội dung, tóm tắt bình luận, ' +
    'hoặc cho bạn biết truyện đang hot và truyện mới. Bạn muốn hỏi gì?';

  // Lưu hội thoại trong sessionStorage để chuyển trang vẫn còn
  function load() {
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.messages)) return s;
    } catch { /* bỏ qua */ }
    return { open: false, messages: [] };
  }
  function save() {
    try {
      state.messages = state.messages.slice(-MAX_STORED);
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch { /* bỏ qua */ }
  }

  const state = load();
  let busy = false;

  // ---------- Dựng giao diện ----------
  const toggle = document.createElement('button');
  toggle.id = 'chatToggle';
  toggle.type = 'button';
  toggle.title = 'Hỏi Meow Bot';
  toggle.innerHTML = '<img src="/images/chatbot.jpg" alt="Chat">';

  const panel = document.createElement('div');
  panel.id = 'chatPanel';
  panel.innerHTML = `
    <div class="chat-header">
      <strong>Comic Meow Bot 🐱</strong>
      <div class="chat-tools">
        <button type="button" id="chatExpand" class="chat-expand" title="Phóng to">⤢</button>
        <button type="button" id="chatClose" class="btn-close btn-close-white" aria-label="Đóng"></button>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-chips" id="chatChips"></div>
    <form class="chat-form" id="chatForm">
      <input id="chatInput" class="form-control form-control-sm" maxlength="500"
             placeholder="Hỏi về truyện..." autocomplete="off">
      <button class="btn btn-warning btn-sm" type="submit" id="chatSend">Gửi</button>
    </form>`;

  document.body.append(toggle, panel);

  const box = panel.querySelector('#chatMessages');
  const chips = panel.querySelector('#chatChips');
  const form = panel.querySelector('#chatForm');
  const input = panel.querySelector('#chatInput');
  const sendBtn = panel.querySelector('#chatSend');
  const expandBtn = panel.querySelector('#chatExpand');

  function cardsHtml(comics) {
    return comics.map(c => `
      <a class="chat-card" href="/comic.html?id=${c.id}">
        <img src="${c.coverUrl ? UI.escapeHtml(c.coverUrl) : UI.placeholder}" alt=""
             onerror="this.onerror=null;this.src=UI.placeholder">
        <div>
          <div class="fw-semibold small">${UI.escapeHtml(c.title)}</div>
          <div class="small text-muted">
            ${UI.escapeHtml(c.author || '')}${c.author ? ' · ' : ''}${c.status === 'Completed' ? 'Hoàn thành' : 'Đang ra'}
          </div>
        </div>
      </a>`).join('');
  }

  function addBubble(role, text, comics) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg ' + role;
    bubble.textContent = text;                 // textContent: an toàn trước XSS
    box.appendChild(bubble);

    if (comics && comics.length) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-cards';
      wrap.innerHTML = cardsHtml(comics);      // dữ liệu đã escapeHtml
      box.appendChild(wrap);
    }
    box.scrollTop = box.scrollHeight;
    return bubble;
  }

  function push(role, text, comics) {
    addBubble(role, text, comics);
    state.messages.push({ role, text, comics: comics || [] });
    save();
    renderChips();
  }

  // Gợi ý câu hỏi nhanh: chỉ hiện khi người dùng chưa hỏi gì
  function renderChips() {
    const asked = state.messages.some(m => m.role === 'user');
    chips.innerHTML = '';
    chips.style.display = asked ? 'none' : 'flex';
    if (asked) return;

    SUGGESTIONS.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm btn-outline-secondary';
      b.textContent = text;
      b.addEventListener('click', () => send(text));
      chips.appendChild(b);
    });
  }

  function setOpen(open) {
    state.open = open;
    panel.classList.toggle('open', open);
    save();
    if (open) {
      box.scrollTop = box.scrollHeight;
      input.focus();
    }
  }

  // Phóng to / thu nhỏ khung chat (nhớ lựa chọn khi chuyển trang)
  function setExpanded(expanded) {
    state.expanded = expanded;
    panel.classList.toggle('expanded', expanded);
    expandBtn.textContent = expanded ? '⤡' : '⤢';
    expandBtn.title = expanded ? 'Thu nhỏ' : 'Phóng to';
    save();
    box.scrollTop = box.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    sendBtn.disabled = value;
  }

  // ---------- Gửi câu hỏi ----------
  async function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;

    input.value = '';
    setBusy(true);
    push('user', text);
    const typing = addBubble('bot typing', 'Đang suy nghĩ...');

    try {
      const res = await Api.post('/api/Chat', { message: text });
      typing.remove();
      push('bot', res.reply, res.comics);
    } catch (err) {
      typing.remove();
      push('bot', err.status === 429
        ? 'Bạn hỏi hơi nhanh, vui lòng chờ một chút rồi hỏi tiếp nhé.'
        : 'Xin lỗi, chatbot đang gặp sự cố: ' + err.message);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  // ---------- Sự kiện ----------
  toggle.addEventListener('click', () => setOpen(!state.open));
  panel.querySelector('#chatClose').addEventListener('click', () => setOpen(false));
  expandBtn.addEventListener('click', () => setExpanded(!state.expanded));
  form.addEventListener('submit', e => {
    e.preventDefault();
    send(input.value);
  });

  // ---------- Khởi động ----------
  if (state.messages.length === 0) {
    state.messages.push({ role: 'bot', text: WELCOME, comics: [] });
  }
  state.messages.forEach(m => addBubble(m.role, m.text, m.comics));
  renderChips();
  setExpanded(!!state.expanded);
  setOpen(!!state.open);
})();
