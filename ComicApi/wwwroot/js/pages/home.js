(() => {
    const PAGE_SIZE = 12;
    const $ = id => document.getElementById(id);

    const hotSection = $('hotSection');
    const hotList = $('hotList');
    const heading = $('listHeading');
    const count = $('listCount');
    const list = $('comicList');
    const pager = $('pager');
    const pills = $('genrePills');
    const statusSel = $('statusSelect');
    const sortSel = $('sortSelect');

    let genres = [];
    let state = readState();   // keyword, genreId, status, sort, page (lấy từ thanh địa chỉ)
    let reqId = 0;             // để bỏ qua kết quả cũ khi người dùng bấm lọc liên tục

    // ---- Trạng thái lọc <-> thanh địa chỉ (để bấm Back, F5 hay gửi link vẫn đúng) ----
    function readState() {
        const p = new URLSearchParams(location.search);
        return {
            keyword: (p.get('keyword') || '').trim(),
            genreId: p.get('genreId') || '',
            status: p.get('status') || '',
            sort: p.get('sort') || '',
            page: Math.max(1, parseInt(p.get('page')) || 1),
        };
    }

    function writeUrl(replace = false) {
        const p = new URLSearchParams();
        if (state.keyword) p.set('keyword', state.keyword);
        if (state.genreId) p.set('genreId', state.genreId);
        if (state.status) p.set('status', state.status);
        if (state.sort) p.set('sort', state.sort);
        if (state.page > 1) p.set('page', state.page);
        const qs = p.toString();
        history[replace ? 'replaceState' : 'pushState'](null, '', qs ? '?' + qs : location.pathname);
    }

    const isFiltered = () =>
        !!(state.keyword || state.genreId || state.status || (state.sort && state.sort !== 'updated'));

    // ---- Hiển thị ----
    function renderPills() {
        const btn = (id, label) =>
            `<button type="button" data-id="${id}" class="btn btn-sm ${String(state.genreId) === String(id) ? 'btn-warning' : 'btn-outline-secondary'}">${UI.escapeHtml(label)}</button>`;
        pills.innerHTML = btn('', 'Tất cả') + genres.map(g => btn(g.id, g.name)).join('');
    }

    function syncControls() {
        statusSel.value = state.status;
        sortSel.value = state.sort || 'updated';
        hotSection.classList.toggle('d-none', isFiltered());
        heading.textContent = !isFiltered()
            ? 'Mới cập nhật'
            : state.keyword ? `Kết quả cho “${state.keyword}”` : 'Danh sách truyện';
        renderPills();
    }

    // ---- Gọi API ----
    async function loadHot() {
        hotList.innerHTML = UI.spinner();
        try {
            const items = await Api.get('/api/Comics/hot?take=6');
            hotList.innerHTML = items.length
                ? items.map(UI.comicCard).join('')
                : UI.message('Chưa có truyện nào.', 'secondary');
        } catch (err) {
            hotList.innerHTML = UI.message(err.message);
        }
    }

    async function loadList() {
        const id = ++reqId;
        list.innerHTML = UI.spinner();

        const q = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE });
        if (state.keyword) q.set('keyword', state.keyword);
        if (state.genreId) q.set('genreId', state.genreId);
        if (state.status) q.set('status', state.status);
        if (state.sort) q.set('sort', state.sort);

        try {
            const data = await Api.get('/api/Comics?' + q);
            if (id !== reqId) return;   // đã có yêu cầu mới hơn, bỏ kết quả này

            // Đang ở trang vượt quá tổng số trang (ví dụ gõ tay trên URL): lùi về trang cuối
            if (data.items.length === 0 && data.totalItems > 0 && state.page > data.totalPages) {
                state.page = data.totalPages;
                writeUrl(true);
                return loadList();
            }

            count.textContent = data.totalItems ? `${UI.formatNumber(data.totalItems)} truyện` : '';
            list.innerHTML = data.items.length
                ? data.items.map(UI.comicCard).join('')
                : UI.message('Không tìm thấy truyện nào phù hợp.', 'secondary');

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                state.page = p;
                writeUrl();
                loadList();
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        } catch (err) {
            if (id !== reqId) return;
            count.textContent = '';
            pager.innerHTML = '';
            list.innerHTML = UI.message(err.message);
        }
    }

    // ---- Sự kiện ----
    function applyChange() {
        state.page = 1;
        writeUrl();
        syncControls();
        loadList();
    }

    pills.addEventListener('click', e => {
        const btn = e.target.closest('button[data-id]');
        if (!btn) return;
        state.genreId = btn.dataset.id;
        applyChange();
    });

    statusSel.addEventListener('change', () => {
        state.status = statusSel.value;
        applyChange();
    });

    sortSel.addEventListener('change', () => {
        state.sort = sortSel.value === 'updated' ? '' : sortSel.value;
        applyChange();
    });

    // Bấm nút Back/Forward của trình duyệt
    window.addEventListener('popstate', () => {
        state = readState();
        syncControls();
        loadList();
    });

    // ---- Khởi động ----
    (async function init() {
        syncControls();
        loadList();
        loadHot();
        try {
            genres = await Api.get('/api/Genres');
            renderPills();
        } catch {
            /* không tải được thể loại thì trang vẫn dùng được */
        }
    })();
})();