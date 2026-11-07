(() => {
    if (!Admin.guard()) return;
    Admin.renderNav('comments');

    const PAGE_SIZE = 20;
    const $ = id => document.getElementById(id);
    const esc = UI.escapeHtml;

    const tbody = $('commentRows');
    const pager = $('pager');
    const totalText = $('totalText');
    const searchInput = $('adminSearchInput');
    const bulkBtn = $('bulkBtn');
    const checkAll = $('checkAll');

    // Có thể mở trang với sẵn bộ lọc, ví dụ /admin/comments.html?userId=5
    const params = new URLSearchParams(location.search);
    const state = {
        keyword: params.get('keyword') || '',
        comicId: params.get('comicId') || '',
        userId: params.get('userId') || '',
        hasGif: false,
        locked: false,
        onlyReplies: false,
        sort: 'newest',
        page: 1,
    };

    const selected = new Set();     // id các bình luận đang được tick (chỉ trong trang hiện tại)
    let reqId = 0;
    let searchTimer = 0;

    searchInput.value = state.keyword;

    const messageRow = html => `<tr><td colspan="6" class="text-center py-4">${html}</td></tr>`;

    // Tô sáng từ khóa trong nội dung (escape từng đoạn nên vẫn an toàn trước XSS)
    function highlight(text, keyword) {
        if (!keyword) return esc(text);

        const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let out = '';
        let last = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
            out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
            last = m.index + m[0].length;
            if (m[0].length === 0) re.lastIndex++;
        }
        return out + esc(text.slice(last));
    }

    // ---------- Thống kê ----------
    async function loadStats() {
        try {
            const s = await Api.get('/api/admin/comments/stats');
            $('stTotal').textContent = UI.formatNumber(s.total);
            $('stGif').textContent = UI.formatNumber(s.withGif);
            $('stDay').textContent = UI.formatNumber(s.last24h);
            $('stLocked').textContent = UI.formatNumber(s.fromLockedUsers);
            $('stReplies').textContent = `trong đó ${UI.formatNumber(s.replies)} phản hồi`;
        } catch {
            /* không tải được thống kê thì bỏ qua, bảng vẫn dùng được */
        }
    }

    // ---------- Danh sách ----------
    function rowHtml(c) {
        const when = UI.parseDate(c.createdAt);
        const exact = when ? when.toLocaleString('vi-VN') : '';

        return `
      <tr data-id="${c.id}" data-replies="${c.replyCount}">
        <td><input type="checkbox" class="form-check-input row-check" aria-label="Chọn bình luận số ${c.id}"></td>
        <td>
          <a class="fw-semibold text-decoration-none" href="#" data-action="filter-user" data-user="${c.userId}">${esc(c.username)}</a>
          ${c.userLocked ? '<span class="badge text-bg-danger ms-1">Bị khóa</span>' : ''}
          <div class="small">
            <a href="/admin/users.html?keyword=${encodeURIComponent(c.username)}">Quản lý tài khoản</a>
          </div>
        </td>
        <td>
          <a href="/comic.html?id=${c.comicId}#binh-luan" target="_blank" rel="noopener">${esc(c.comicTitle)}</a>
        </td>
        <td>
          ${c.content
                ? `<div class="cmt-text">${highlight(c.content, state.keyword)}</div>`
                : '<span class="text-muted fst-italic">(chỉ có ảnh GIF)</span>'}
          ${c.gifUrl ? `<img class="admin-gif" src="${esc(c.gifUrl)}" alt="GIF đính kèm" loading="lazy">` : ''}
          ${c.parentId ? `<div class="small text-muted mt-1">↳ Trả lời <strong>${esc(c.parentUsername || '?')}</strong>: “${esc((c.parentContent || '(GIF)').slice(0, 60))}”</div>` : ''}
          <div class="small text-muted mt-1">♥ ${UI.formatNumber(c.likeCount)} · ${UI.formatNumber(c.replyCount)} phản hồi</div>
        </td>
        <td class="small text-nowrap" title="${esc(exact)}">${UI.timeAgo(c.createdAt)}</td>
        <td class="text-nowrap text-end">
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">Xóa</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="purge-user"
                  data-user="${c.userId}" data-name="${esc(c.username)}"
                  title="Xóa mọi bình luận của người này">Xóa của người này</button>
        </td>
      </tr>`;
    }

    function renderChips(first) {
        const chips = [];
        if (state.comicId)
            chips.push(`<span class="badge text-bg-secondary">Truyện: ${esc(first?.comicTitle || '#' + state.comicId)}
        <button type="button" class="btn-close btn-close-white ms-1" data-clear="comicId" aria-label="Bỏ lọc truyện"></button></span>`);
        if (state.userId)
            chips.push(`<span class="badge text-bg-secondary">Người dùng: ${esc(first?.username || '#' + state.userId)}
        <button type="button" class="btn-close btn-close-white ms-1" data-clear="userId" aria-label="Bỏ lọc người dùng"></button></span>`);
        $('chips').innerHTML = chips.join('');
    }

    function updateSelection() {
        const boxes = [...tbody.querySelectorAll('.row-check')];
        $('selCount').textContent = selected.size;
        bulkBtn.disabled = selected.size === 0;

        checkAll.checked = boxes.length > 0 && boxes.every(b => b.checked);
        checkAll.indeterminate = boxes.some(b => b.checked) && !checkAll.checked;
    }

    async function load() {
        const id = ++reqId;
        selected.clear();
        updateSelection();
        tbody.innerHTML = messageRow('<div class="spinner-border text-warning"></div>');

        const q = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE, sort: state.sort });
        if (state.keyword) q.set('keyword', state.keyword);
        if (state.comicId) q.set('comicId', state.comicId);
        if (state.userId) q.set('userId', state.userId);
        if (state.hasGif) q.set('hasGif', 'true');
        if (state.locked) q.set('locked', 'true');
        if (state.onlyReplies) q.set('onlyReplies', 'true');

        try {
            const data = await Api.get('/api/admin/comments?' + q);
            if (id !== reqId) return;     // đã có lần lọc mới hơn, bỏ kết quả này

            // Xóa hết ở trang cuối thì lùi về trang trước
            if (data.items.length === 0 && data.totalItems > 0 && state.page > 1) {
                state.page = data.totalPages;
                return load();
            }

            totalText.textContent = `(${UI.formatNumber(data.totalItems)})`;
            tbody.innerHTML = data.items.length
                ? data.items.map(rowHtml).join('')
                : messageRow('<span class="text-muted">Không có bình luận nào khớp điều kiện.</span>');

            renderChips(data.items[0]);
            updateSelection();

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                state.page = p;
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch (err) {
            if (id !== reqId) return;
            tbody.innerHTML = messageRow(`<div class="alert alert-danger mb-0">${esc(err.message)}</div>`);
        }
    }

    const refreshAll = () => { load(); loadStats(); };

    // ---------- Chọn nhiều ----------
    tbody.addEventListener('change', e => {
        const cb = e.target.closest('.row-check');
        if (!cb) return;

        const id = Number(cb.closest('tr').dataset.id);
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        updateSelection();
    });

    checkAll.addEventListener('change', () => {
        tbody.querySelectorAll('.row-check').forEach(cb => {
            cb.checked = checkAll.checked;
            const id = Number(cb.closest('tr').dataset.id);
            if (checkAll.checked) selected.add(id);
            else selected.delete(id);
        });
        updateSelection();
    });

    // ---------- Xóa ----------
    tbody.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        e.preventDefault();

        const action = btn.dataset.action;
        const row = btn.closest('tr');

        try {
            if (action === 'filter-user') {
                state.userId = btn.dataset.user;
                state.page = 1;
                load();
                return;
            }

            if (action === 'delete') {
                const n = Number(row.dataset.replies) || 0;
                if (!confirm(n > 0 ? `Xóa bình luận này và ${n} phản hồi của nó?` : 'Xóa bình luận này?')) return;
                await Api.del('/api/comments/' + row.dataset.id);      // API xóa sẵn có, Admin được phép
                Admin.toast('Đã xóa bình luận');
                refreshAll();
                return;
            }

            if (action === 'purge-user') {
                const name = btn.dataset.name;
                if (!confirm(`Xóa MỌI bình luận của "${name}" trên toàn website?\nViệc này không thể hoàn tác.`)) return;
                const res = await Api.del('/api/admin/comments/by-user/' + btn.dataset.user);
                Admin.toast(`Đã xóa ${res.deleted} bình luận của ${name}`);
                refreshAll();
            }
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    });

    bulkBtn.addEventListener('click', async () => {
        if (!selected.size) return;
        if (!confirm(`Xóa ${selected.size} bình luận đã chọn?\nViệc này không thể hoàn tác.`)) return;

        try {
            const res = await Api.post('/api/admin/comments/bulk-delete', { ids: [...selected] });
            Admin.toast(`Đã xóa ${res.deleted} bình luận`);
            refreshAll();
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    });

    // ---------- Bộ lọc ----------
    $('filterForm').addEventListener('submit', e => e.preventDefault());

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.keyword = searchInput.value.trim();
            state.page = 1;
            load();
        }, 300);                          // chờ người dùng ngừng gõ một chút rồi mới tìm
    });

    $('sortSelect').addEventListener('change', e => {
        state.sort = e.target.value;
        state.page = 1;
        load();
    });
    $('gifOnly').addEventListener('change', e => {
        state.hasGif = e.target.checked;
        state.page = 1;
        load();
    });
    $('lockedOnly').addEventListener('change', e => {
        state.locked = e.target.checked;
        state.page = 1;
        load();
    });
    $('repliesOnly').addEventListener('change', e => {
        state.onlyReplies = e.target.checked;
        state.page = 1;
        load();
    });

    // Bấm ✕ trên nhãn lọc (truyện / người dùng) để bỏ điều kiện đó
    $('chips').addEventListener('click', e => {
        const btn = e.target.closest('[data-clear]');
        if (!btn) return;
        state[btn.dataset.clear] = '';
        state.page = 1;
        load();
    });

    loadStats();
    load();
})();