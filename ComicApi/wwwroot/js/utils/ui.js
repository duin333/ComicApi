const UI = (() => {
    // Ảnh thay thế khi truyện chưa có bìa hoặc ảnh lỗi
    const placeholder = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">' +
        '<rect width="100%" height="100%" fill="#e9ecef"/>' +
        '<text x="50%" y="50%" fill="#adb5bd" font-family="sans-serif" font-size="28" ' +
        'text-anchor="middle">Chưa có ảnh</text></svg>');

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

    // Thẻ truyện dùng ở trang chủ
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
              <div class="small text-muted">${formatNumber(c.viewCount)} lượt xem · ${timeAgo(c.updatedAt)}</div>
            </div>
          </div>
        </a>
      </div>`;
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

    // Thanh menu dùng chung, chèn vào <div id="navbar"></div>
    function renderNavbar() {
        const host = document.getElementById('navbar');
        if (!host) return;

        const user = Auth.isLoggedIn() ? Auth.getUser() : null;
        const keyword = new URLSearchParams(location.search).get('keyword') || '';
        const onAuthPage = /(login|register)\.html$/.test(location.pathname);
        const loginHref = onAuthPage
            ? '/login.html'
            : '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
        const userItems = `
            <li><a class="dropdown-item" href="/following.html">Truyện đang theo dõi</a></li>
            <li><a class="dropdown-item" href="/history.html">Lịch sử đọc</a></li>
            <li><hr class="dropdown-divider"></li>`;

        const adminItems = user && user.role === 'Admin'
            ? '<li><a class="dropdown-item" href="/admin/comics.html">Quản trị</a></li><li><hr class="dropdown-divider"></li>'
            : '';

        const right = user
            ? `<li class="nav-item dropdown">
           <a class="nav-link dropdown-toggle text-white" href="#" role="button" data-bs-toggle="dropdown">
             ${escapeHtml(user.username)}
             ${user.role === 'Admin' ? '<span class="badge text-bg-warning ms-1">Admin</span>' : ''}
           </a>
           <ul class="dropdown-menu dropdown-menu-end">
            ${userItems}${adminItems}
             <li><button class="dropdown-item" id="logoutBtn" type="button">Đăng xuất</button></li>
           </ul>
         </li>`
            : `<li class="nav-item me-lg-2 mb-2 mb-lg-0"><a class="btn btn-outline-light btn-sm" href="${loginHref}">Đăng nhập</a></li>
         <li class="nav-item"><a class="btn btn-warning btn-sm" href="/register.html">Đăng ký</a></li>`;

        host.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
        <div class="container">
          <a class="navbar-brand fw-bold" href="/index.html">ComicHub</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <form class="d-flex mx-lg-auto my-2 my-lg-0 nav-search" action="/index.html" method="get" role="search">
              <input class="form-control me-2" type="search" name="keyword"
                     placeholder="Tìm truyện hoặc tác giả..." value="${escapeHtml(keyword)}">
              <button class="btn btn-warning" type="submit">Tìm</button>
            </form>
            <ul class="navbar-nav ms-lg-3 align-items-lg-center">${right}</ul>
          </div>
        </div>
      </nav>`;

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            Auth.logout();
            location.href = '/index.html';
        });
    }

    renderNavbar();
    // Nút chat nổi trên mọi trang (trừ khu quản trị)
    if (!location.pathname.startsWith('/admin/')) {
        const s = document.createElement('script');
        s.src = '/js/utils/chatWidget.js';
        document.body.appendChild(s);
    }

    return {
        placeholder, escapeHtml, formatNumber, formatDate, timeAgo,
        spinner, message, comicCard, chapterLabel, renderPagination, renderNavbar,
    };
})();