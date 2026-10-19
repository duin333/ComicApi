(() => {
    if (!Auth.requireLogin()) return;

    const PAGE_SIZE = 12;
    const $ = id => document.getElementById(id);
    const list = $('historyList');
    const pager = $('pager');
    const totalText = $('totalText');
    const clearBtn = $('clearBtn');

    let page = 1;

    function itemHtml(h) {
        const cover = h.coverUrl ? UI.escapeHtml(h.coverUrl) : UI.placeholder;
        const label = UI.chapterLabel({ number: h.chapterNumber, title: h.chapterTitle });

        return `
      <div class="list-group-item d-flex align-items-center gap-3"
           data-comic="${h.comicId}" data-title="${UI.escapeHtml(h.comicTitle)}">
        <a href="comic.html?id=${h.comicId}">
          <img class="history-thumb" src="${cover}" alt=""
               onerror="this.onerror=null;this.src=UI.placeholder">
        </a>
        <div class="flex-grow-1">
          <a class="fw-semibold text-decoration-none text-dark" href="comic.html?id=${h.comicId}">
            ${UI.escapeHtml(h.comicTitle)}
          </a>
          <div class="small text-muted">Đã đọc tới ${UI.escapeHtml(label)} · ${UI.timeAgo(h.readAt)}</div>
        </div>
        <a class="btn btn-sm btn-warning" href="reader.html?id=${h.chapterId}">Đọc tiếp</a>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="remove">Xóa</button>
      </div>`;
    }

    async function load() {
        list.innerHTML = '<div class="list-group-item text-center py-4"><div class="spinner-border text-warning"></div></div>';
        try {
            const data = await Api.get(`/api/History?page=${page}&pageSize=${PAGE_SIZE}`);

            if (data.items.length === 0 && data.totalItems > 0 && page > 1) {
                page = data.totalPages;
                return load();
            }

            totalText.textContent = `(${UI.formatNumber(data.totalItems)})`;
            clearBtn.classList.toggle('d-none', data.totalItems === 0);

            list.innerHTML = data.items.length
                ? data.items.map(itemHtml).join('')
                : `<div class="list-group-item text-center text-muted py-5">
             Bạn chưa đọc truyện nào. <a href="index.html">Khám phá truyện</a>
           </div>`;

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                page = p;
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch (err) {
            list.innerHTML = `<div class="list-group-item"><div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div></div>`;
            pager.innerHTML = '';
        }
    }

    list.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-action="remove"]');
        if (!btn) return;

        const row = btn.closest('[data-comic]');
        if (!confirm(`Xóa "${row.dataset.title}" khỏi lịch sử đọc?`)) return;

        try {
            await Api.del(`/api/History/comics/${row.dataset.comic}`);
            load();
        } catch (err) {
            alert(err.message);
        }
    });

    clearBtn.addEventListener('click', async () => {
        if (!confirm('Xóa toàn bộ lịch sử đọc? Việc này không thể hoàn tác.')) return;
        try {
            await Api.del('/api/History');
            page = 1;
            load();
        } catch (err) {
            alert(err.message);
        }
    });

    load();
})();