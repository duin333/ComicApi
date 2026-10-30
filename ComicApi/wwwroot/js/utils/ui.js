const UI = (() => {
    // ================== Thông tin hiển thị (sửa cho đúng nhóm của bạn) ==================
    const SITE = {
        name: 'ComicHub',
        tagline: 'Đọc truyện tranh trực tuyến, theo dõi truyện yêu thích, chấm sao, bình luận và hỏi chatbot gợi ý truyện.',
        team: 'Nhóm 5 · Đồ án môn học',
        email: 'nhom5@example.com',
        facebook: '#',
        github: '#',
        logo: '',        // khi đã có file logo, ghi đường dẫn vào đây, ví dụ '/img/logo-dark.png'
        year: 2026,
    };

    // Ảnh thay thế khi truyện chưa có bìa hoặc ảnh lỗi
    const placeholder = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">' +
        '<rect width="100%" height="100%" fill="#e9ecef"/>' +
        '<text x="50%" y="50%" fill="#adb5bd" font-family="sans-serif" font-size="28" ' +
        'text-anchor="middle">Chưa có ảnh</text></svg>');

    // ================== Tiện ích chung ==================

    // Luôn dùng hàm này khi chèn dữ liệu từ server vào HTML (chống XSS)
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    const formatNumber = n => new Intl.NumberFormat('vi-VN').format(n ?? 0);

    // Server lưu giờ UTC nhưng chuỗi ngày có thể thiếu chữ "Z" ở cuối,
    // nếu không bổ sung thì trình duyệt hiểu nhầm là giờ máy và lệch 7 tiếng
    function parseDate(value) {
        if (!value) return null;
        const s = String(value);
        return new Date(/(Z|[+-]\d\d:\d\d)$/.test(s) ? s : s + 'Z');
    }

    function formatDate(value) {
        const d = parseDate(value);
        return d ? d.toLocaleDateString('vi-VN') : '';
    }

    function timeAgo(value) {
        const d = parseDate(value);
        if (!d) return '';
        const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
        if (sec < 60) return 'Vừa xong';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} phút trước`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} giờ trước`;
        const day = Math.floor(hr / 24);
        if (day < 30) return `${day} ngày trước`;
        return formatDate(value);
    }

    // Các khối thông báo (đặt trong .row nên bọc col-12)
    const spinner = () =>
        '<div class="col-12 text-center py-5"><div class="spinner-border text-warning" role="status"></div></div>';

    const message = (text, type = 'danger') =>
        `<div class="col-12"><div class="alert alert-${type} mb-0">${escapeHtml(text)}</div></div>`;

    // Ngôi sao tô màu theo điểm (ví dụ 4.3 sao thì tô vàng 86% chiều rộng)
    function stars(average) {
        const pct = Math.max(0, Math.min(5, Number(average) || 0)) / 5 * 100;
        return `<span class="stars" aria-hidden="true">★★★★★<span class="fill" style="width:${pct}%">★★★★★</span></span>`;
    }

    // Dòng đánh giá trên thẻ truyện: "★★★★☆ 4.3 (25)" hoặc "Chưa có đánh giá"
    function ratingLine(c) {
        if (!c.ratingCount) return '<div class="small text-muted">Chưa có đánh giá</div>';
        return `<div class="small">${stars(c.ratingAverage)} ` +
            `<span class="text-muted">${Number(c.ratingAverage).toFixed(1)} (${formatNumber(c.ratingCount)})</span></div>`;
    }

    // Thẻ truyện dùng ở trang chủ (sẽ làm lại ở bước 10.9)
    function comicCard(c) {
        const cover = c.coverUrl ? escapeHtml(c.coverUrl) : placeholder;
        const done = c.status === 'Completed';
        const latest = c.latestChapterNumber ? `Chương ${c.latestChapterNumber}` : 'Chưa có chương';
        return `
      <div class="col">
        <a class="comic-card text-decoration-none" href="comic.html?id=${c.id}">
          <div class="card h-100 border-0 shadow-sm">
            <div class="cover-wrap">
              <img src="${cover}" alt="${escapeHtml(c.title)}" loading="lazy"
                   onerror="this.onerror=null;this.src=UI.placeholder">
              <span class="badge ${done ? 'text-bg-success' : 'text-bg-primary'} status-badge">
                ${done ? 'Hoàn thành' : 'Đang ra'}
              </span>
            </div>
            <div class="card-body p-2">
              <h6 class="comic-title mb-1">${escapeHtml(c.title)}</h6>
              <div class="small text-muted">${latest}</div>
              ${ratingLine(c)}
              <div class="small text-muted">${formatNumber(c.viewCount)} lượt xem · ${timeAgo(c.updatedAt)}</div>
            </div>
          </div>
        </a>
      </div>`;
    }

    // "Hành động" -> "hanh-dong" (dùng để ghép tên file ảnh thể loại)
    const slug = text => String(text || '').toLowerCase().replace(/đ/g, 'd')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Nhãn ruy-băng của thẻ truyện, tính từ dữ liệu thật
    function comicLabel(c, hotIds) {
        if (hotIds && hotIds.has(c.id)) return { cls: 'hot', text: 'HOT' };

        const updated = parseDate(c.updatedAt);
        if (updated && Date.now() - updated.getTime() < 3 * 24 * 3600 * 1000) return { cls: 'new', text: 'MỚI' };

        if (c.status === 'Completed') return { cls: 'done', text: 'HOÀN THÀNH' };
        if (c.ratingCount >= 5 && c.ratingAverage >= 4.5) return { cls: 'top', text: 'TOP ĐÁNH GIÁ' };
        return { cls: 'ongoing', text: 'ĐANG RA' };
    }

    // Thẻ truyện kiểu mới: bìa bên trái, ruy-băng ngang, thông tin bên phải
    function comicCardX(c, ctx = {}) {
        const cover = c.coverUrl ? escapeHtml(c.coverUrl) : placeholder;
        const label = comicLabel(c, ctx.hotIds);
        const genres = (c.genres || []).slice(0, 2).map(escapeHtml).join(', ');
        const meta = [escapeHtml(c.author || 'Đang cập nhật'), genres].filter(Boolean).join(' · ');
        const latest = c.latestChapterNumber ? `Chương ${c.latestChapterNumber}` : 'Chưa có chương';
        const rating = c.ratingCount
            ? `${stars(c.ratingAverage)} <span class="cx-score">${Number(c.ratingAverage).toFixed(1)}</span>
         <span class="cx-count">(${formatNumber(c.ratingCount)})</span>`
            : '<span class="cx-count">Chưa có đánh giá</span>';

        return `
      <a class="cx-card" href="/comic.html?id=${c.id}" title="${escapeHtml(c.title)}">
        <div class="cx-ribbon cx-${label.cls}">${label.text}</div>
        <div class="cx-cover">
          <img src="${cover}" alt="" loading="lazy" onerror="this.onerror=null;this.src=UI.placeholder">
        </div>
        <div class="cx-body">
          <div class="cx-title">${escapeHtml(c.title)}</div>
          <div class="cx-meta">${meta}</div>
          <div class="cx-meta">${latest} · ${formatNumber(c.viewCount)} lượt xem</div>
          <div class="cx-foot">
            <div class="cx-rating">${rating}</div>
            <span class="cx-detail">Chi tiết</span>
          </div>
        </div>
      </a>`;
    }

    // Khung xương hiện trong lúc chờ dữ liệu (thay cho vòng quay)
    const skeletonCards = n => Array.from({ length: n }, () => `
    <div class="cx-skel" aria-hidden="true">
      <div class="skel skel-cover"></div>
      <div class="skel-body">
        <div class="skel skel-line" style="width:75%"></div>
        <div class="skel skel-line" style="width:55%"></div>
        <div class="skel skel-line" style="width:65%"></div>
      </div>
    </div>`).join('');

    // Thẻ poster nhỏ cho hàng "Cùng thể loại"
    function posterCard(c) {
        const cover = c.coverUrl ? escapeHtml(c.coverUrl) : placeholder;
        const badge = c.ratingCount
            ? `<span class="poster-badge">★ ${Number(c.ratingAverage).toFixed(1)}</span>`
            : '';
        const latest = c.latestChapterNumber ? `Chương ${c.latestChapterNumber}` : 'Chưa có chương';

        return `
      <a class="poster-card" href="/comic.html?id=${c.id}" title="${escapeHtml(c.title)}">
        <div class="poster-cover">
          <img src="${cover}" alt="" loading="lazy" onerror="this.onerror=null;this.src=UI.placeholder">
          ${badge}
        </div>
        <div class="poster-title">${escapeHtml(c.title)}</div>
        <div class="poster-sub">${latest}</div>
      </a>`;
    }

    // Thông báo nhỏ ở giữa đáy màn hình (thay cho alert)
    function toast(text, type = 'success') {
        let box = document.getElementById('uiToastBox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'uiToastBox';
            box.className = 'ui-toast-box';
            box.setAttribute('role', 'status');
            box.setAttribute('aria-live', 'polite');
            document.body.appendChild(box);
        }

        const el = document.createElement('div');
        el.className = `ui-toast ui-toast-${type}`;
        el.textContent = text;                  // textContent: an toàn trước XSS
        box.appendChild(el);

        setTimeout(() => {
            el.classList.add('out');
            setTimeout(() => el.remove(), 300);
        }, 3200);
    }

    // Thanh phân trang: « 1 … 4 5 [6] 7 8 … 20 »
    function renderPagination(container, page, totalPages, onChange) {
        if (totalPages <= 1) {
            container.innerHTML = '';
            container.onclick = null;
            return;
        }

        const items = [];
        const add = (label, p, { active = false, disabled = false } = {}) =>
            items.push(
                `<li class="page-item ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}">` +
                `<button type="button" class="page-link" data-page="${p}">${label}</button></li>`);
        const dots = () =>
            items.push('<li class="page-item disabled"><span class="page-link">…</span></li>');

        add('«', page - 1, { disabled: page === 1 });

        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);

        if (start > 1) {
            add('1', 1);
            if (start > 2) dots();
        }
        for (let p = start; p <= end; p++) add(p, p, { active: p === page });
        if (end < totalPages) {
            if (end < totalPages - 1) dots();
            add(totalPages, totalPages);
        }

        add('»', page + 1, { disabled: page === totalPages });

        container.innerHTML =
            `<nav><ul class="pagination justify-content-center flex-wrap">${items.join('')}</ul></nav>`;

        container.onclick = e => {
            const btn = e.target.closest('button[data-page]');
            if (!btn || btn.parentElement.classList.contains('disabled')) return;
            onChange(Number(btn.dataset.page));
        };
    }

    // "Chương 3" hoặc "Chương 3: Tên chương" (không lặp khi tên chương chỉ là "Chương 3")
    function chapterLabel(c) {
        const base = `Chương ${c.number}`;
        const title = (c.title || '').trim();
        return title && title.toLowerCase() !== base.toLowerCase() ? `${base}: ${title}` : base;
    }

    // ================== Biểu tượng SVG ==================
    const svg = inner =>
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

    const icon = {
        menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
        close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
        search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
        moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
        sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
        mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
        bubble: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.2l-4.6 3.9A.8.8 0 0 1 6.9 20.7V17H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/></svg>',
    };
    // ================== Trạng thái trống ==================
    // Khi có ảnh minh họa riêng, điền đường dẫn vào đây (ví dụ '/img/empty/empty-follow.svg').
    // Để trống thì dùng biểu tượng có sẵn.
    const EMPTY_IMAGES = { search: '', follow: '', history: '', comments: '' };

    const EMPTY_ICONS = {
        search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 11h5"/>'),
        follow: svg('<path d="M12 21s-7.5-4.6-9.6-9.3A5.6 5.6 0 0 1 12 6.6a5.6 5.6 0 0 1 9.6 5.1C19.5 16.4 12 21 12 21z"/>'),
        history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
        comments: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>'),
    };

    function emptyState({ kind = 'search', title, text = '', href = '', label = '' }) {
        const img = EMPTY_IMAGES[kind];
        const art = img
            ? `<img class="empty-img" src="${escapeHtml(img)}" alt="">`
            : `<div class="empty-icon">${EMPTY_ICONS[kind] || EMPTY_ICONS.search}</div>`;

        return `
      <div class="empty-state">
        ${art}
        <h3>${escapeHtml(title)}</h3>
        ${text ? `<p class="text-muted">${escapeHtml(text)}</p>` : ''}
        ${href ? `<a class="btn btn-brand" href="${escapeHtml(href)}">${escapeHtml(label || 'Quay lại')}</a>` : ''}
      </div>`;
    }

    // Nút "lên đầu trang" ở góc dưới bên trái, chỉ hiện khi đã cuộn xuống
    function initBackToTop() {
        if (location.pathname.startsWith('/admin/')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'to-top';
        btn.title = 'Lên đầu trang';
        btn.setAttribute('aria-label', 'Lên đầu trang');
        btn.innerHTML = svg('<path d="M6 15l6-6 6 6"/>');
        document.body.appendChild(btn);

        const onScroll = () => btn.classList.toggle('show', window.scrollY > 600);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // ================== Chế độ sáng/tối ==================
    const THEME_KEY = 'comichub_theme';
    const getTheme = () =>
        document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';

    function setTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        try { localStorage.setItem(THEME_KEY, theme); } catch { /* bỏ qua */ }
    }

    // ================== Thanh menu ==================
    function brandHtml() {
        return SITE.logo
            ? `<img class="brand-img" src="${escapeHtml(SITE.logo)}" alt="${escapeHtml(SITE.name)}">`
            : `<span class="brand-mark">${icon.bubble}</span><span class="brand-text">Comic<b>Hub</b></span>`;
    }

    // Liên kết nào đang là trang hiện tại (để gạch chân mục đang chọn)
    function isCurrent(href) {
        const target = new URL(href, location.origin);
        const norm = p => (p === '/' ? '/index.html' : p).toLowerCase();
        if (norm(target.pathname) !== norm(location.pathname)) return false;

        const here = new URLSearchParams(location.search);
        const keys = [...target.searchParams.keys()];
        if (keys.length === 0) return ['sort', 'status', 'genreId', 'keyword'].every(k => !here.has(k));
        return keys.every(k => here.get(k) === target.searchParams.get(k));
    }

    const GENRE_KEY = 'comichub_genres';

    function renderNavbar() {
        const host = document.getElementById('navbar');
        if (!host) return;

        const $ = id => document.getElementById(id);
        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        const isAdminUser = !!user && user.role === 'Admin';
        const keyword = new URLSearchParams(location.search).get('keyword') || '';
        const onAuthPage = /(login|register)\.html$/.test(location.pathname);
        const loginHref = onAuthPage
            ? '/login.html'
            : '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);

        const mainLinks = [
            { href: '/index.html', label: 'Trang chủ' },
            { href: '/following.html', label: 'Thư viện của tôi' },
            { href: '/index.html?status=Completed', label: 'Truyện đã hoàn thành' },
            { href: '/index.html?sort=title', label: 'Danh sách A-Z' },
        ];

        const memberLinks = user
            ? `<a href="/following.html">Truyện đang theo dõi</a>
         <a href="/history.html">Lịch sử đọc</a>
         ${isAdminUser ? '<a href="/admin/comics.html">Trang quản trị</a>' : ''}
         <a href="#" data-action="logout">Đăng xuất</a>`
            : `<a href="${loginHref}">Đăng nhập</a>
         <a href="/register.html">Đăng ký</a>`;

        const initial = escapeHtml((user?.username || '?').charAt(0).toUpperCase());

        const accountArea = user
            ? `<div class="user-wrap">
           <button id="userBtn" class="avatar-btn" type="button" aria-haspopup="true" aria-expanded="false"
                   title="${escapeHtml(user.username)}">${initial}</button>
           <div id="userMenu" class="user-menu" hidden>
             <div class="um-head">
               <div class="fw-semibold">${escapeHtml(user.username)}</div>
               <div class="small text-muted">${isAdminUser ? 'Quản trị viên' : 'Thành viên'}</div>
             </div>
             <a href="/following.html">Truyện đang theo dõi</a>
             <a href="/history.html">Lịch sử đọc</a>
             ${isAdminUser ? '<a href="/admin/comics.html">Trang quản trị</a>' : ''}
             <button type="button" data-action="logout">Đăng xuất</button>
           </div>
         </div>`
            : `<a class="btn btn-sm btn-outline-light d-none d-sm-inline-flex" href="${loginHref}">Đăng nhập</a>
         <a class="btn btn-sm btn-brand d-none d-sm-inline-flex" href="/register.html">Đăng ký</a>
         <a class="btn btn-sm btn-brand d-sm-none" href="${loginHref}">Đăng nhập</a>`;

        host.innerHTML = `
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="/index.html" aria-label="${escapeHtml(SITE.name)}, về trang chủ">${brandHtml()}</a>
          <button id="menuBtn" class="icon-btn" type="button" aria-label="Mở menu"
                  aria-expanded="false" aria-controls="megaMenu">${icon.menu}</button>
          <nav class="main-links" aria-label="Điều hướng chính">
            ${mainLinks.map(l => `<a href="${l.href}" class="${isCurrent(l.href) ? 'active' : ''}">${l.label}</a>`).join('')}
          </nav>
          <div class="header-actions">
            <button id="themeBtn" class="icon-btn" type="button" aria-label="Chuyển giao diện sáng hoặc tối"></button>
            <button id="searchBtn" class="icon-btn" type="button" aria-label="Tìm kiếm"
                    aria-expanded="false" title="Tìm kiếm (phím /)">${icon.search}</button>
            ${accountArea}
          </div>
        </div>

        <div id="megaMenu" class="mega-menu" aria-hidden="true">
          <div class="container">
            <div class="mega-grid">
              <div class="mega-col mega-mobile">
                <h6>Điều hướng</h6>
                ${mainLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
              </div>
              <div class="mega-col">
                <h6>Truyện</h6>
                <a href="/index.html">Mới cập nhật</a>
                <a href="/index.html?sort=title">Danh sách A-Z</a>
                <a href="/index.html?status=Completed">Truyện đã hoàn thành</a>
                <a href="/index.html?sort=views">Đang thịnh hành</a>
              </div>
              <div class="mega-col">
                <h6>Bảng xếp hạng</h6>
                <a href="/index.html?sort=views">Xem nhiều nhất</a>
                <a href="/index.html?sort=rating">Đánh giá cao nhất</a>
                <a href="/index.html?sort=follows">Theo dõi nhiều nhất</a>
              </div>
              <div class="mega-col">
                <h6>Thành viên</h6>
                ${memberLinks}
              </div>
              <div class="mega-col">
                <h6>Thể loại</h6>
                <div id="megaGenres" class="mega-genres"><span class="small" style="color:rgba(255,255,255,.5)">Đang tải...</span></div>
              </div>
            </div>
          </div>
        </div>

        <div id="searchPanel" class="search-panel" aria-hidden="true">
          <div class="container">
            <div class="search-box">
              ${icon.search}
              <input id="searchInput" type="search" placeholder="Tìm truyện hoặc tác giả..."
                     autocomplete="off" value="${escapeHtml(keyword)}">
              <button id="searchGo" class="btn btn-sm btn-brand" type="button">Tìm</button>
            </div>
            <div id="searchResults" class="search-results"></div>
          </div>
        </div>
      </header>`;

        const header = host.querySelector('.site-header');
        const menuBtn = $('menuBtn');
        const megaMenu = $('megaMenu');
        const searchBtn = $('searchBtn');
        const searchPanel = $('searchPanel');
        const searchInput = $('searchInput');
        const searchResults = $('searchResults');
        const themeBtn = $('themeBtn');
        const userBtn = $('userBtn');
        const userMenu = $('userMenu');

        // ---------- Đóng/mở các bảng ----------
        function setOpen(panel, btn, open) {
            panel.classList.toggle('open', open);
            panel.setAttribute('aria-hidden', String(!open));
            btn.setAttribute('aria-expanded', String(open));
        }

        function closeAll() {
            setOpen(megaMenu, menuBtn, false);
            menuBtn.innerHTML = icon.menu;
            menuBtn.setAttribute('aria-label', 'Mở menu');
            setOpen(searchPanel, searchBtn, false);
            if (userMenu) {
                userMenu.hidden = true;
                userBtn.setAttribute('aria-expanded', 'false');
            }
        }

        menuBtn.addEventListener('click', e => {
            e.stopPropagation();
            const willOpen = !megaMenu.classList.contains('open');
            closeAll();
            if (willOpen) {
                setOpen(megaMenu, menuBtn, true);
                menuBtn.innerHTML = icon.close;
                menuBtn.setAttribute('aria-label', 'Đóng menu');
                loadGenres();
            }
        });

        function openSearch() {
            closeAll();
            setOpen(searchPanel, searchBtn, true);
            searchInput.focus();
            searchInput.select();
            if (searchInput.value.trim()) runSearch();
        }

        searchBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (searchPanel.classList.contains('open')) closeAll();
            else openSearch();
        });

        if (userBtn) {
            userBtn.addEventListener('click', e => {
                e.stopPropagation();
                const willOpen = userMenu.hidden;
                closeAll();
                userMenu.hidden = !willOpen;
                userBtn.setAttribute('aria-expanded', String(willOpen));
            });
        }

        // Bấm ra ngoài thanh menu thì đóng, bấm Esc cũng đóng
        document.addEventListener('click', e => {
            if (!header.contains(e.target)) closeAll();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeAll();

            // Phím "/" mở ô tìm kiếm (trừ khi đang gõ vào ô nhập liệu khác)
            const active = document.activeElement;
            const typing = active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
            if (e.key === '/' && !typing) {
                e.preventDefault();
                openSearch();
            }
        });

        header.addEventListener('click', e => {
            if (e.target.closest('[data-action="logout"]')) {
                e.preventDefault();
                Auth.logout();
                location.href = '/index.html';
            }
        });

        // ---------- Nút sáng/tối ----------
        function paintTheme() {
            const dark = getTheme() === 'dark';
            themeBtn.innerHTML = dark ? icon.sun : icon.moon;
            themeBtn.title = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
        }
        themeBtn.addEventListener('click', () => {
            setTheme(getTheme() === 'dark' ? 'light' : 'dark');
            paintTheme();
        });
        paintTheme();

        // ---------- Thể loại trong menu (lấy từ database, có nhớ tạm) ----------
        const genreLinks = list =>
            list.map(g => `<a href="/index.html?genreId=${g.id}">${escapeHtml(g.name)}</a>`).join('');

        async function loadGenres() {
            const box = $('megaGenres');
            if (!box || box.dataset.loaded) return;

            try {
                const cached = JSON.parse(sessionStorage.getItem(GENRE_KEY));
                if (Array.isArray(cached) && cached.length) {
                    box.innerHTML = genreLinks(cached);
                    box.dataset.loaded = '1';
                    return;
                }
            } catch { /* bỏ qua */ }

            try {
                const list = await Api.get('/api/Genres');
                box.innerHTML = genreLinks(list);
                box.dataset.loaded = '1';
                try { sessionStorage.setItem(GENRE_KEY, JSON.stringify(list)); } catch { /* bỏ qua */ }
            } catch {
                box.innerHTML = '<span class="small" style="color:rgba(255,255,255,.5)">Không tải được thể loại</span>';
            }
        }

        // ---------- Tìm kiếm trực tiếp ----------
        let searchTimer = 0;
        let searchReq = 0;
        let activeIdx = -1;

        async function runSearch() {
            const q = searchInput.value.trim();
            clearTimeout(searchTimer);

            if (q.length < 2) {
                searchResults.innerHTML = q ? '<div class="sr-empty">Nhập thêm ít nhất 2 ký tự...</div>' : '';
                return;
            }

            const req = ++searchReq;
            searchResults.innerHTML = '<div class="sr-empty">Đang tìm...</div>';

            try {
                const data = await Api.get(`/api/Comics?keyword=${encodeURIComponent(q)}&pageSize=6&sort=views`);
                if (req !== searchReq) return;     // đã có lần gõ mới hơn, bỏ kết quả này

                if (!data.items.length) {
                    searchResults.innerHTML = `<div class="sr-empty">Không tìm thấy truyện nào cho “${escapeHtml(q)}”</div>`;
                    return;
                }

                const rows = data.items.map(c => {
                    const cover = c.coverUrl ? escapeHtml(c.coverUrl) : placeholder;
                    const rate = c.ratingCount ? `★ ${Number(c.ratingAverage).toFixed(1)}` : 'Chưa có đánh giá';
                    return `
            <a class="sr-item" href="/comic.html?id=${c.id}">
              <img src="${cover}" alt="" loading="lazy" onerror="this.onerror=null;this.src=UI.placeholder">
              <div>
                <div class="sr-title">${escapeHtml(c.title)}</div>
                <div class="sr-meta">${escapeHtml(c.author || 'Đang cập nhật')} ·
                  ${c.status === 'Completed' ? 'Hoàn thành' : 'Đang ra'} · ${rate}</div>
              </div>
            </a>`;
                }).join('');

                searchResults.innerHTML = rows +
                    `<a class="sr-all" href="/index.html?keyword=${encodeURIComponent(q)}">Xem tất cả ${formatNumber(data.totalItems)} kết quả</a>`;
                activeIdx = -1;
            } catch (err) {
                if (req !== searchReq) return;
                searchResults.innerHTML = `<div class="sr-empty">${escapeHtml(err.message)}</div>`;
            }
        }

        function goSearch() {
            const q = searchInput.value.trim();
            if (q) location.href = '/index.html?keyword=' + encodeURIComponent(q);
        }

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(runSearch, 250);    // chờ người dùng ngừng gõ một chút
        });

        searchInput.addEventListener('keydown', e => {
            const items = [...searchResults.querySelectorAll('.sr-item')];

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!items.length) return;
                e.preventDefault();
                activeIdx = e.key === 'ArrowDown'
                    ? (activeIdx + 1) % items.length
                    : (activeIdx <= 0 ? items.length - 1 : activeIdx - 1);
                items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
                items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIdx >= 0 && items[activeIdx]) location.href = items[activeIdx].href;
                else goSearch();
            }
        });

        $('searchGo').addEventListener('click', goSearch);
    }

    // ================== Chân trang ==================
    function renderFooter() {
        // Bỏ chân trang tĩnh cũ nằm trong từng file HTML
        document.querySelectorAll('body > footer:not(.site-footer)').forEach(f => f.remove());

        // Khu quản trị và trang đọc truyện không cần chân trang
        if (location.pathname.startsWith('/admin/') || /reader\.html$/.test(location.pathname)) return;

        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        const onAuthPage = /(login|register)\.html$/.test(location.pathname);

        const cta = (user || onAuthPage) ? '' : `
      <div class="footer-cta">
        <div class="container">
          <div>
            <div class="cta-title">Tham gia ${escapeHtml(SITE.name)} ngay hôm nay</div>
            <div class="small opacity-75">Theo dõi truyện yêu thích, chấm sao, bình luận và hỏi chatbot gợi ý truyện.</div>
          </div>
          <a class="btn btn-light" href="/register.html">Đăng ký miễn phí</a>
        </div>
      </div>`;

        const accountLinks = user
            ? '<a href="/following.html">Truyện đang theo dõi</a><a href="/history.html">Lịch sử đọc</a>'
            : '<a href="/login.html">Đăng nhập</a><a href="/register.html">Đăng ký</a>';

        const footer = document.createElement('footer');
        footer.className = 'site-footer';
        footer.innerHTML = `
      ${cta}
      <div class="container footer-main">
        <div class="row g-4">
          <div class="col-lg-4">
            <a class="brand" href="/index.html">${brandHtml()}</a>
            <p class="small mt-3 mb-3">${escapeHtml(SITE.tagline)}</p>
            <a class="social-pill" href="${escapeHtml(SITE.facebook)}" target="_blank" rel="noopener">Facebook</a>
            <a class="social-pill" href="${escapeHtml(SITE.github)}" target="_blank" rel="noopener">GitHub</a>
          </div>
          <div class="col-6 col-lg-2 footer-col">
            <h6>Khám phá</h6>
            <a href="/index.html">Mới cập nhật</a>
            <a href="/index.html?sort=title">Danh sách A-Z</a>
            <a href="/index.html?status=Completed">Truyện đã hoàn thành</a>
            <a href="/index.html?sort=rating">Đánh giá cao nhất</a>
          </div>
          <div class="col-6 col-lg-2 footer-col">
            <h6>Tài khoản</h6>
            ${accountLinks}
          </div>
          <div class="col-lg-4 footer-col">
            <h6>Liên hệ nhóm</h6>
            <a href="mailto:${escapeHtml(SITE.email)}">${icon.mail}${escapeHtml(SITE.email)}</a>
            <div class="small mb-3">${escapeHtml(SITE.team)}</div>
            <h6>Công nghệ</h6>
            <span class="tech-chip">ASP.NET Core 8</span>
            <span class="tech-chip">MySQL</span>
            <span class="tech-chip">JWT</span>
            <span class="tech-chip">Bootstrap 5</span>
            <span class="tech-chip">AI Chatbot</span>
          </div>
        </div>
      </div>
      <div class="footer-bar">
        <div class="container d-flex flex-wrap justify-content-between gap-2">
          <span>© ${SITE.year} ${escapeHtml(SITE.name)}. Đồ án môn học.</span>
          <span>Hình ảnh minh họa chỉ dùng cho mục đích học tập.</span>
        </div>
      </div>`;

        document.body.appendChild(footer);
    }

    renderNavbar();
    renderFooter();
    initBackToTop();

    // Nút chat nổi trên mọi trang (trừ khu quản trị)
    if (!location.pathname.startsWith('/admin/')) {
        const s = document.createElement('script');
        s.src = '/js/utils/chatWidget.js';
        document.body.appendChild(s);
    }

    return {
        placeholder, escapeHtml, formatNumber, formatDate, timeAgo, parseDate,
        spinner, message, stars, ratingLine, comicCard, slug, comicLabel, comicCardX, skeletonCards,
        posterCard, toast, emptyState, chapterLabel, renderPagination, renderNavbar, getTheme, setTheme,
    };
})();