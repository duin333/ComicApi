(() => {
    if (!Auth.requireLogin()) return;

    const PAGE_SIZE = 12;
    const $ = id => document.getElementById(id);
    const esc = UI.escapeHtml;
    const list = $('historyList');
    const pager = $('pager');
    const totalText = $('totalText');
    const clearBtn = $('clearBtn');

    let page = 1;

    // Nhóm theo ngày đọc: Hôm nay, Hôm qua, 7 ngày qua, Cũ hơn
    function dayGroup(iso) {
        const d = UI.parseDate(iso);
        if (!d) return 'Cũ hơn';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);

        const diff = Math.round((today - day) / 86400000);
        if (diff <= 0) return 'Hôm nay';
        if (diff === 1) return 'Hôm qua';
        if (diff < 7) return '7 ngày qua';
        return 'Cũ hơn';
    }

    function itemHtml(h) {
        const cover = h.coverUrl ? esc(h.coverUrl) : UI.placeholder;
        const label = UI.chapterLabel({ number: h.chapterNumber, title: h.chapterTitle });

        return `
      <div class="history-item" data-comic="${h.comicId}" data-title="${esc(h.comicTitle)}">
        <a class="history-cover" href="/comic.html?id=${h.comicId}">
          <img src="${cover}" alt="" loading="lazy" onerror="this.onerror=null;this.src=UI.placeholder">
        </a>
        <div class="history-info">
          <a class="history-title" href="/comic.html?id=${h.comicId}">${esc(h.comicTitle)}</a>
          <div class="history-meta">Đã đọc tới <strong>${esc(label)}</strong></div>
          <div class="history-meta">${UI.timeAgo(h.readAt)}</div>
        </div>
        <div class="history-actions">
          <a class="btn btn-brand btn-sm" href="/reader.html?id=${h.chapterId}">Đọc tiếp</a>
          <button type="button" class="btn btn-sm btn-pill-outline" data-action="remove">Xóa</button>
        </div>
      </div>`;
    }

    function renderItems(items) {
        let current = '';
        return items.map(h => {
            const group = dayGroup(h.readAt);
            const heading = group !== current ? `<h2 class="history-group">${group}</h2>` : '';
            current = group;
            return heading + itemHtml(h);
        }).join('');
    }

    function skeleton() {
        return Array.from({ length: 4 }, () => `
      <div class="history-item" aria-hidden="true">
        <div class="skel" style="width:64px;height:96px"></div>
        <div class="flex-grow-1">
          <div class="skel skel-line mb-2" style="width:50%"></div>
          <div class="skel skel-line" style="width:30%"></div>
        </div>
      </div>`).join('');
    }

    async function load() {
        list.innerHTML = skeleton();
        try {
            const data = await Api.get(`/api/History?page=${page}&pageSize=${PAGE_SIZE}`);

            if (data.items.length === 0 && data.totalItems > 0 && page > 1) {
                page = data.totalPages;
                return load();
            }

            totalText.textContent = data.totalItems ? `(${UI.formatNumber(data.totalItems)})` : '';
            clearBtn.classList.toggle('d-none', data.totalItems === 0);

            list.innerHTML = data.items.length
                ? renderItems(data.items)
                : UI.emptyState({
                    kind: 'history',
                    title: 'Bạn chưa đọc truyện nào',
                    text: 'Mỗi chương bạn mở sẽ được lưu ở đây, để bạn đọc tiếp đúng chỗ dang dở bất cứ lúc nào.',
                    href: '/index.html?browse=1',
                    label: 'Bắt đầu đọc',
                });

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                page = p;
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch (err) {
            list.innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
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
            UI.toast('Đã xóa khỏi lịch sử đọc');
            load();
        } catch (err) {
            UI.toast(err.message, 'danger');
        }
    });

    clearBtn.addEventListener('click', async () => {
        if (!confirm('Xóa toàn bộ lịch sử đọc? Việc này không thể hoàn tác.')) return;
        try {
            await Api.del('/api/History');
            UI.toast('Đã xóa toàn bộ lịch sử đọc');
            page = 1;
            load();
        } catch (err) {
            UI.toast(err.message, 'danger');
        }
    });

    load();
})();