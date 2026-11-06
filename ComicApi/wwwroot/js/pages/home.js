(() => {
    const PAGE_SIZE = 12;
    const HERO_MS = 3000;
    const reduceMotion = false;

    const $ = id => document.getElementById(id);
    const esc = UI.escapeHtml;

    // Các phần chỉ hiện ở chế độ "trang chủ" (ẩn khi đang xem danh sách)
    const LANDING = ['heroSection', 'genreSection', 'hotSection', 'newSection', 'topSection'];

    const browseSection = $('browseSection');
    const heading = $('listHeading');
    const count = $('listCount');
    const list = $('comicList');
    const pager = $('pager');
    const pills = $('genrePills');
    const statusSel = $('statusSelect');
    const sortSel = $('sortSelect');

    let state = readState();      // keyword, genreId, status, sort, browse, page (lấy từ thanh địa chỉ)
    let genres = [];
    let reqId = 0;
    let landingStarted = false;

    // ---------- Dữ liệu dùng chung, chỉ tải một lần ----------
    let hotRaw = null;
    let genresRaw = null;
    const hotRequest = () => (hotRaw ??= Api.get('/api/Comics/hot?take=6'));
    const hotSafe = () => hotRequest().catch(() => []);
    const genresSafe = () => (genresRaw ??= Api.get('/api/Genres').catch(() => []));
    const hotIdsOf = hot => new Set(hot.map(c => c.id));

    // ---------- Trạng thái <-> thanh địa chỉ ----------
    function readState() {
        const p = new URLSearchParams(location.search);
        return {
            keyword: (p.get('keyword') || '').trim(),
            genreId: p.get('genreId') || '',
            status: p.get('status') || '',
            sort: p.get('sort') || '',
            browse: p.get('browse') === '1',
            page: Math.max(1, parseInt(p.get('page')) || 1),
        };
    }

    const hasFilter = () => !!(state.keyword || state.genreId || state.status || state.sort);
    const isBrowse = () => hasFilter() || state.browse || state.page > 1;

    function writeUrl(replace = false) {
        const p = new URLSearchParams();
        if (state.keyword) p.set('keyword', state.keyword);
        if (state.genreId) p.set('genreId', state.genreId);
        if (state.status) p.set('status', state.status);
        if (state.sort) p.set('sort', state.sort);
        if (state.browse && !hasFilter()) p.set('browse', '1');
        if (state.page > 1) p.set('page', state.page);
        const qs = p.toString();
        history[replace ? 'replaceState' : 'pushState'](null, '', qs ? '?' + qs : location.pathname);
    }

    // Chuyển giữa chế độ trang chủ và chế độ danh sách
    function syncMode() {
        const browse = isBrowse();
        LANDING.forEach(id => $(id).classList.toggle('d-none', browse));
        browseSection.classList.toggle('d-none', !browse);

        if (browse) {
            stopHero();
            syncControls();
        } else {
            startLanding();
            resumeHero();
        }
    }

    // =====================================================================
    // BANNER NỔI BẬT
    // =====================================================================
    let heroIndex = 0;
    let heroTimer = 0;

    const ARROW_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    const ARROW_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

    function heroSlideHtml(c, i, total) {
        const cover = c.coverUrl ? esc(c.coverUrl) : UI.placeholder;
        const chips = c.genres.slice(0, 3).map(g => `<span class="hero-chip">${esc(g.name)}</span>`).join('');
        const rating = c.ratingCount
            ? `${UI.stars(c.ratingAverage)} <strong>${Number(c.ratingAverage).toFixed(1)}</strong> <span>(${UI.formatNumber(c.ratingCount)})</span>`
            : '<span>Chưa có đánh giá</span>';

        return `
      <article class="hero-slide" role="group" aria-roledescription="slide" aria-label="${i + 1} trên ${total}">
        <div class="hero-bg" data-bg="${cover}"></div>
        <div class="container hero-inner">
          <div class="hero-cover-wrap">
            <img class="hero-cover" src="${cover}" alt="Bìa truyện ${esc(c.title)}"
                 ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
                 data-fallback="placeholder">
            <a class="hero-readnow" href="/comic.html?id=${c.id}" data-readnow="${c.id}">Đọc ngay</a>
          </div>
          <div class="hero-panel-shell">
            <div class="hero-panel">
              <div class="hero-kicker">#${i + 1} · ĐANG THỊNH HÀNH</div>
              <h2 class="hero-title">${esc(c.title)}</h2>
              <div class="hero-meta">${chips}<span class="hero-rating">${rating}</span></div>
              <p class="hero-desc">${esc(c.description || 'Truyện chưa có mô tả.')}</p>
              <div class="hero-actions">
                <a class="btn btn-brand" href="/comic.html?id=${c.id}">Chi tiết truyện</a>
                <span class="hero-stats">${UI.formatNumber(c.viewCount)} lượt xem · ${c.chapterCount} chương</span>
              </div>
            </div>
          </div>
        </div>
      </article>`;
    }

    async function loadHero() {
        const section = $('heroSection');
        section.innerHTML = '<div class="hero-skel"></div>';

        try {
            const items = await Api.get('/api/Comics/featured?take=5');
            if (!items.length) {
                section.innerHTML = '';
                return;
            }
            renderHero(items);
        } catch {
            section.innerHTML = '';      // lỗi thì bỏ banner, các phần còn lại vẫn dùng được
        }
    }

    function renderHero(items) {
        const section = $('heroSection');
        section.innerHTML = `
      <div class="hero" id="hero" role="region" aria-roledescription="carousel" aria-label="Truyện nổi bật">
        <div class="hero-track">${items.map((c, i) => heroSlideHtml(c, i, items.length)).join('')}</div>
        <button type="button" class="hero-arrow prev" aria-label="Truyện trước">${ARROW_LEFT}</button>
        <button type="button" class="hero-arrow next" aria-label="Truyện tiếp theo">${ARROW_RIGHT}</button>
        <div class="hero-dots">
          ${items.map((_, i) => `<button type="button" class="hero-dash" data-i="${i}" aria-label="Xem truyện thứ ${i + 1}"></button>`).join('')}
        </div>
      </div>`;

        // Đặt ảnh nền bằng JS để xử lý an toàn mọi ký tự trong đường dẫn
        section.querySelectorAll('.hero-bg').forEach(el => {
            el.style.backgroundImage = `url(${JSON.stringify(el.dataset.bg)})`;
        });

        const hero = $('hero');

        hero.addEventListener('click', async e => {
            const dash = e.target.closest('.hero-dash');
            if (dash) { showHero(Number(dash.dataset.i)); restartHero(); return; }
            if (e.target.closest('.hero-arrow.prev')) { showHero(heroIndex - 1); restartHero(); return; }
            if (e.target.closest('.hero-arrow.next')) { showHero(heroIndex + 1); restartHero(); return; }

            const read = e.target.closest('[data-readnow]');
            if (read) {
                e.preventDefault();
                await readNow(read.dataset.readnow);
            }
        });

        // Rê chuột hoặc đang focus vào banner thì tạm dừng tự chuyển
        hero.addEventListener('mouseenter', pauseHero);
        hero.addEventListener('mouseleave', resumeHero);
        hero.addEventListener('focusin', pauseHero);
        hero.addEventListener('focusout', resumeHero);

        // Vuốt trên điện thoại
        let startX = null;
        hero.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
        hero.addEventListener('touchend', e => {
            if (startX === null) return;
            const dx = e.changedTouches[0].clientX - startX;
            startX = null;
            if (Math.abs(dx) > 50) { showHero(heroIndex + (dx < 0 ? 1 : -1)); restartHero(); }
        });

        // Phím mũi tên khi đang focus trong banner
        hero.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') { showHero(heroIndex - 1); restartHero(); }
            if (e.key === 'ArrowRight') { showHero(heroIndex + 1); restartHero(); }
        });

        showHero(0);
        restartHero();
    }

    function showHero(i) {
        const slides = document.querySelectorAll('.hero-slide');
        const dashes = document.querySelectorAll('.hero-dash');
        if (!slides.length) return;

        heroIndex = (i + slides.length) % slides.length;
        slides.forEach((s, k) => {
            const on = k === heroIndex;
            s.classList.toggle('active', on);
            s.setAttribute('aria-hidden', String(!on));
        });
        dashes.forEach((d, k) => d.classList.toggle('active', k === heroIndex));
    }

    function stopHero() {
        clearInterval(heroTimer);
        heroTimer = 0;
    }

    function restartHero() {
        stopHero();
        const hero = $('hero');
        if (!hero || reduceMotion || document.hidden || isBrowse()) return;

        hero.classList.remove('paused');

        // Khởi động lại thanh tiến độ ở dấu gạch đang chọn
        const dash = document.querySelector('.hero-dash.active');
        if (dash) {
            dash.classList.remove('active');
            void dash.offsetWidth;
            dash.classList.add('active');
        }
        heroTimer = setInterval(() => showHero(heroIndex + 1), HERO_MS);
    }

    function pauseHero() {
        stopHero();
        $('hero')?.classList.add('paused');
    }

    function resumeHero() {
        if ($('hero')) restartHero();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopHero();
        else resumeHero();
    });

    // "ĐỌC NGAY" mở thẳng chương đầu tiên (nếu chưa có chương thì về trang truyện)
    async function readNow(comicId) {
        try {
            const chapters = await Api.get(`/api/Comics/${comicId}/chapters`);
            location.href = chapters.length ? `/reader.html?id=${chapters[0].id}` : `/comic.html?id=${comicId}`;
        } catch {
            location.href = `/comic.html?id=${comicId}`;
        }
    }

    // =====================================================================
    // CÁC MỤC CỦA TRANG CHỦ
    // =====================================================================
    function startLanding() {
        if (landingStarted) return;
        landingStarted = true;

        loadHero();
        loadGenreTiles();
        loadHotSection();
        loadNewSection();
        loadTopSection();
    }

    async function loadGenreTiles() {
        const box = $('genreTiles');
        const items = await genresSafe();

        box.innerHTML = items.length
            ? items.map((g, i) => `
          <a class="genre-tile" href="/index.html?genreId=${g.id}"
             style="background:linear-gradient(135deg,hsl(${(260 + i * 37) % 360},55%,38%),hsl(${(300 + i * 37) % 360},60%,26%))">
            <img src="/img/genres/genre-${UI.slug(g.name)}.jpg" alt="" loading="lazy" data-fallback="remove">
            <span class="genre-name">${esc(g.name)}</span>
          </a>`).join('')
            : '<div class="text-muted">Chưa có thể loại nào.</div>';
    }

    async function loadHotSection() {
        const box = $('hotList');
        box.innerHTML = UI.skeletonCards(6);
        try {
            const hot = await hotRequest();
            const ctx = { hotIds: hotIdsOf(hot) };
            box.innerHTML = hot.length
                ? hot.map(c => UI.comicCardX(c, ctx)).join('')
                : UI.message('Chưa có truyện nào.', 'secondary');
        } catch (err) {
            box.innerHTML = UI.message(err.message);
        }
    }

    async function loadNewSection() {
        const box = $('newList');
        box.innerHTML = UI.skeletonCards(6);
        try {
            const [data, hot] = await Promise.all([Api.get(`/api/Comics?page=1&pageSize=${PAGE_SIZE}`), hotSafe()]);
            const ctx = { hotIds: hotIdsOf(hot) };
            box.innerHTML = data.items.length
                ? data.items.map(c => UI.comicCardX(c, ctx)).join('')
                : UI.message('Chưa có truyện nào.', 'secondary');
        } catch (err) {
            box.innerHTML = UI.message(err.message);
        }
    }

    async function loadTopSection() {
        const box = $('topList');
        box.innerHTML = UI.skeletonCards(6);
        try {
            const [data, hot] = await Promise.all([Api.get(`/api/Comics?sort=rating&pageSize=${PAGE_SIZE}`), hotSafe()]);
            const ctx = { hotIds: hotIdsOf(hot) };

            // Chỉ tính truyện có từ 5 lượt đánh giá trở lên (1 lượt 5 sao chưa đủ tin cậy)
            const top = data.items.filter(c => c.ratingCount >= 5).slice(0, 6);
            box.innerHTML = top.length
                ? top.map(c => UI.comicCardX(c, ctx)).join('')
                : UI.message('Chưa có truyện nào đủ lượt đánh giá.', 'secondary');
        } catch (err) {
            box.innerHTML = UI.message(err.message);
        }
    }

    // =====================================================================
    // CHẾ ĐỘ DANH SÁCH (tìm kiếm, lọc, sắp xếp, phân trang)
    // =====================================================================
    function renderPills() {
        const btn = (id, label) =>
            `<button type="button" data-id="${id}" class="btn btn-sm ${String(state.genreId) === String(id) ? 'btn-warning' : 'btn-outline-secondary'}">${esc(label)}</button>`;
        pills.innerHTML = btn('', 'Tất cả') + genres.map(g => btn(g.id, g.name)).join('');
    }

    function syncControls() {
        statusSel.value = state.status;
        sortSel.value = state.sort || 'updated';
        heading.textContent = state.keyword ? `Kết quả cho “${state.keyword}”` : 'Danh sách truyện';
        renderPills();
    }

    const emptyState = () => UI.emptyState({
        kind: 'search',
        title: 'Không tìm thấy truyện nào',
        text: 'Thử đổi từ khóa hoặc bỏ bớt bộ lọc nhé.',
        href: '/index.html?browse=1',
        label: 'Xóa bộ lọc',
    });

    async function loadList() {
        const id = ++reqId;
        list.innerHTML = UI.skeletonCards(6);

        const q = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE });
        if (state.keyword) q.set('keyword', state.keyword);
        if (state.genreId) q.set('genreId', state.genreId);
        if (state.status) q.set('status', state.status);
        if (state.sort) q.set('sort', state.sort);

        try {
            const [data, hot] = await Promise.all([Api.get('/api/Comics?' + q), hotSafe()]);
            if (id !== reqId) return;     // đã có yêu cầu mới hơn, bỏ kết quả này

            // Đang ở trang vượt quá tổng số trang (ví dụ gõ tay trên URL): lùi về trang cuối
            if (data.items.length === 0 && data.totalItems > 0 && state.page > data.totalPages) {
                state.page = data.totalPages;
                writeUrl(true);
                return loadList();
            }

            count.textContent = data.totalItems ? `${UI.formatNumber(data.totalItems)} truyện` : '';
            const ctx = { hotIds: hotIdsOf(hot) };
            list.innerHTML = data.items.length
                ? data.items.map(c => UI.comicCardX(c, ctx)).join('')
                : emptyState();

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                state.page = p;
                state.browse = true;
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

    function applyChange() {
        state.page = 1;
        state.browse = true;        // đổi bộ lọc xong thì ở lại chế độ danh sách
        writeUrl();
        syncMode();
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
        syncMode();
        if (isBrowse()) loadList();
    });

    // ---------- Khởi động ----------
    (async function init() {
        genres = await genresSafe();
        syncMode();
        if (isBrowse()) loadList();
    })();
})();