(() => {
    const root = document.getElementById('comicRoot');
    const id = parseInt(new URLSearchParams(location.search).get('id'));
    const COMMENT_PAGE_SIZE = 10;
    const NEW_CHAPTER_MS = 3 * 24 * 3600 * 1000;     // chương tạo trong 3 ngày gần đây thì gắn nhãn "Mới"
    const DESC_LIMIT = 380;                           // mô tả dài hơn thì thu gọn
    const $ = elId => document.getElementById(elId);
    const esc = UI.escapeHtml;

    const me = Auth.isLoggedIn() ? Auth.getUser() : null;   // người đang đăng nhập (nếu có)

    const SHARE_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>' +
        '<circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

    const EMOJIS = [
        '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😅',
        '😆', '😉', '🙂', '😏', '😬', '🥺', '😇', '🤤', '😜', '🤪', '😈', '👻',
        '😢', '😭', '😤', '😡', '😱', '🤔', '🙄', '😴', '🤗', '🤯', '💀', '👀',
        '👍', '👎', '👏', '🙏', '💪', '🔥', '💯', '✨', '❤️', '💔', '💖', '🎉',
        '🌸', '⭐', '🌈', '☕', '🍿', '📖', '📚', '🎬', '🐱', '🐶', '🍀', '⚡',
    ];

    // GIF trong thư viện của website (các file ở wwwroot/uploads/gifs)
    const GIF_LIBRARY = [
        { url: '/uploads/gifs/hay-qua.gif', label: 'Hay quá' },
        { url: '/uploads/gifs/haha.gif', label: 'Haha' },
        { url: '/uploads/gifs/hong-chuong-moi.gif', label: 'Hóng chương mới' },
        { url: '/uploads/gifs/tuyet-voi.gif', label: 'Tuyệt vời' },
        { url: '/uploads/gifs/buon-qua.gif', label: 'Buồn quá' },
        { url: '/uploads/gifs/10-diem.gif', label: '10 điểm' },
        { url: '/uploads/gifs/wow.gif', label: 'Wow' },
        { url: '/uploads/gifs/cam-on.gif', label: 'Cảm ơn' },
    ];

    // Giống quy tắc ở server: GIF từ Giphy hoặc Tenor, bắt buộc https và đuôi .gif hoặc .webp
    const EXTERNAL_GIF =
        /^https:\/\/(media[0-4]?\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\/[^\s?#]*\.(gif|webp)(\?[^\s#]*)?$/i;

    const emptySummary = () => ({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0], myRating: null });

    let comic = null;
    let chapters = [];            // sắp theo số chương tăng dần (đúng như server trả về)
    let newestFirst = true;       // hiển thị chương mới nhất lên đầu
    let chapterFilter = '';       // chữ đang gõ trong ô tìm chương
    let lastRead = null;          // chương đọc gần nhất của người dùng (nếu có)
    let following = false;        // tôi có đang theo dõi truyện này không
    let rating = emptySummary();  // tổng hợp đánh giá của truyện
    let commentPage = 1;
    let commentSort = 'newest';   // newest | top
    let commentTotal = 0;         // tổng bình luận tính cả phản hồi
    let selectedGif = null;       // GIF đang chọn cho bình luận sắp gửi

    const notFoundHtml = text => `
    <div class="container py-5 text-center">
      <div class="nf-code">404</div>
      <h2 class="mb-2">${esc(text)}</h2>
      <p class="text-muted">Có thể truyện đã bị xóa hoặc đường dẫn không đúng.</p>
      <a class="btn btn-brand" href="/index.html">Về trang chủ</a>
    </div>`;

    // Thiếu hoặc sai ?id= trên địa chỉ
    if (!id) {
        root.innerHTML = notFoundHtml('Không tìm thấy truyện');
        return;
    }

    (async function init() {
        root.innerHTML = '<div class="hero-skel" style="height:420px"></div>';
        try {
            // Gọi 3 API cùng lúc cho nhanh. Đánh giá lỗi thì vẫn hiện trang với đánh giá trống
            const [c, list, summary] = await Promise.all([
                Api.get('/api/Comics/' + id),
                Api.get(`/api/Comics/${id}/chapters`),
                Api.get(`/api/comics/${id}/ratings`).catch(() => emptySummary()),
            ]);
            comic = c;
            chapters = list;
            rating = summary;
            render();
        } catch (err) {
            root.innerHTML = err.status === 404
                ? notFoundHtml('Không tìm thấy truyện')
                : `<div class="container py-5"><div class="row">${UI.message(err.message)}</div></div>`;
        }
    })();

    // =====================================================================
    // DỰNG TRANG
    // =====================================================================
    function render() {
        document.title = `${comic.title} - ComicHub`;

        const cover = comic.coverUrl ? esc(comic.coverUrl) : UI.placeholder;
        const done = comic.status === 'Completed';
        const firstGenre = comic.genres[0];
        const chips = comic.genres
            .map(g => `<a class="detail-chip" href="/index.html?genreId=${g.id}">${esc(g.name)}</a>`).join('');
        const infoChips = comic.genres
            .map(g => `<a class="badge text-bg-secondary text-decoration-none me-1" href="/index.html?genreId=${g.id}">${esc(g.name)}</a>`).join('')
            || '<span class="text-muted">Chưa phân loại</span>';

        const first = chapters[0];
        const last = chapters[chapters.length - 1];
        const readButtons = chapters.length
            ? `<a class="btn btn-brand btn-lg" href="/reader.html?id=${first.id}">Đọc từ đầu</a>
         <a class="btn btn-outline-light btn-lg" href="/reader.html?id=${last.id}">Chương mới nhất</a>`
            : '<button class="btn btn-secondary btn-lg" disabled>Chưa có chương</button>';

        const stat = (value, label, elId) => `
      <div class="detail-stat">
        <strong ${elId ? `id="${elId}"` : ''}>${UI.formatNumber(value)}</strong>
        <span>${label}</span>
      </div>`;

        const desc = comic.description || 'Truyện chưa có mô tả.';
        const longDesc = desc.length > DESC_LIMIT;

        root.innerHTML = `
      <section class="detail-hero">
        <div class="detail-bg" data-bg="${cover}"></div>
        <div class="container detail-hero-inner">
          <div class="detail-cover">
            <img src="${cover}" alt="Bìa truyện ${esc(comic.title)}" data-fallback="placeholder">
          </div>
          <div class="detail-info">
            <nav class="detail-crumbs" aria-label="Đường dẫn">
              <a href="/index.html">Trang chủ</a><span>/</span>
              ${firstGenre ? `<a href="/index.html?genreId=${firstGenre.id}">${esc(firstGenre.name)}</a><span>/</span>` : ''}
              <span>${esc(comic.title)}</span>
            </nav>
            <h1 class="detail-title">${esc(comic.title)}</h1>
            <div class="detail-sub">
              <span class="status-pill ${done ? 'done' : 'ongoing'}">${done ? 'Hoàn thành' : 'Đang ra'}</span>
              <span>Tác giả: ${esc(comic.author || 'Đang cập nhật')}</span>
              <span>Cập nhật ${UI.timeAgo(comic.updatedAt)}</span>
            </div>
            <div class="detail-genres">${chips}</div>
            <div class="detail-rating"><span id="ratingInline"></span><a href="#danh-gia">Xem đánh giá</a></div>
            <div class="detail-stats">
              ${stat(comic.viewCount, 'Lượt xem')}
              ${stat(chapters.length, 'Chương')}
              ${stat(comic.followCount, 'Theo dõi', 'followStat')}
              ${stat(comic.commentCount, 'Bình luận', 'commentStat')}
            </div>
            <div id="readButtons" class="detail-actions">
              ${readButtons}
              <button id="followBtn" type="button" class="btn btn-outline-light btn-lg">+ Theo dõi</button>
              <button id="shareBtn" type="button" class="icon-btn share-btn" aria-label="Chia sẻ truyện" title="Chia sẻ">${SHARE_ICON}</button>
            </div>
          </div>
        </div>
      </section>

      <div class="detail-tabs-wrap">
        <div class="container">
          <nav id="detailTabs" class="detail-tabs" aria-label="Các phần của trang">
            <a href="#gioi-thieu" data-tab="gioi-thieu" class="active">Giới thiệu</a>
            <a href="#chuong" data-tab="chuong">Chương (<span id="tabChapters">${chapters.length}</span>)</a>
            <a href="#danh-gia" data-tab="danh-gia">Đánh giá</a>
            <a href="#binh-luan" data-tab="binh-luan">Bình luận (<span id="tabComments">${UI.formatNumber(comic.commentCount)}</span>)</a>
          </nav>
        </div>
      </div>

      <div class="container detail-body">
        <section id="gioi-thieu" class="detail-section">
          <h2 class="section-title mb-4">Giới thiệu</h2>
          <div class="row g-4">
            <div class="col-lg-8">
              <div id="descBox" class="desc-text ${longDesc ? 'desc-clamp' : ''}">${esc(desc)}</div>
              ${longDesc ? '<button id="descToggle" type="button" class="btn btn-link px-0">Xem thêm</button>' : ''}
            </div>
            <div class="col-lg-4">
              <div class="info-card">
                <dl>
                  <dt>Tác giả</dt><dd>${esc(comic.author || 'Đang cập nhật')}</dd>
                  <dt>Trạng thái</dt><dd>${done ? 'Hoàn thành' : 'Đang ra'}</dd>
                  <dt>Thể loại</dt><dd>${infoChips}</dd>
                  <dt>Số chương</dt><dd>${chapters.length}</dd>
                  <dt>Ngày đăng</dt><dd>${UI.formatDate(comic.createdAt)}</dd>
                  <dt>Cập nhật</dt><dd>${UI.timeAgo(comic.updatedAt)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section id="chuong" class="detail-section">
          <h2 class="section-title mb-4">Danh sách chương</h2>
          <div class="chapter-tools">
            <input id="chapterSearch" class="form-control" style="max-width:260px" type="search"
                   placeholder="Tìm chương..." aria-label="Tìm chương">
            <button id="sortBtn" type="button" class="btn btn-pill-outline btn-sm">Mới nhất trước</button>
          </div>
          <div id="chapterBox" class="chapter-list"></div>
        </section>

        <section id="danh-gia" class="detail-section">
          <h2 class="section-title mb-4">Đánh giá</h2>
          <div id="ratingCard" class="card border-0 shadow-sm">
            <div id="ratingBody" class="card-body"></div>
          </div>
        </section>

        <section id="binh-luan" class="detail-section">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
            <h2 class="section-title mb-0">Bình luận (<span id="commentCount">${UI.formatNumber(comic.commentCount)}</span>)</h2>
            <div id="commentSortTabs" class="sort-tabs" role="group" aria-label="Sắp xếp bình luận">
              <button type="button" class="sort-tab active" data-sort="newest" aria-pressed="true">Mới nhất</button>
              <button type="button" class=" sort-tab" data-sort="top" aria-pressed="false">Nổi bật</button>
            </div>
          </div>
          <div class="card border-0 shadow-sm">
            <div class="card-body">
              <div id="commentFormBox" class="mb-3"></div>
              <div id="commentList"></div>
              <div id="commentPager" class="mt-3"></div>
            </div>
          </div>
        </section>

        <section id="relatedSection" class="detail-section d-none">
          <h2 id="relatedTitle" class="section-title mb-4">Có thể bạn cũng thích</h2>
          <div id="relatedRow" class="poster-row"></div>
        </section>
      </div>`;

        // Ảnh nền đặt bằng JS để xử lý an toàn mọi ký tự trong đường dẫn
        const bg = root.querySelector('.detail-bg');
        bg.style.backgroundImage = `url(${JSON.stringify(bg.dataset.bg)})`;

        $('followBtn').addEventListener('click', toggleFollow);
        $('shareBtn').addEventListener('click', share);

        $('descToggle')?.addEventListener('click', () => {
            const clamped = $('descBox').classList.toggle('desc-clamp');
            $('descToggle').textContent = clamped ? 'Xem thêm' : 'Thu gọn';
        });

        $('sortBtn').addEventListener('click', () => {
            newestFirst = !newestFirst;
            $('sortBtn').textContent = newestFirst ? 'Mới nhất trước' : 'Cũ nhất trước';
            renderChapters();
        });
        $('chapterSearch').addEventListener('input', e => {
            chapterFilter = e.target.value;
            renderChapters();
        });

        // Đánh giá: gắn sự kiện một lần ở thẻ cha (phần bên trong được vẽ lại mỗi khi có thay đổi)
        const ratingCard = $('ratingCard');
        ratingCard.addEventListener('mouseover', e => {
            const b = e.target.closest('.star-btn');
            if (b) paintStars(Number(b.dataset.v));                       // rê chuột: xem trước số sao
        });
        ratingCard.addEventListener('mouseout', e => {
            if (e.target.closest('.star-btn') && !e.relatedTarget?.closest?.('.star-btn'))
                paintStars(rating.myRating || 0);                           // rời khỏi các sao: về số sao thật
        });
        ratingCard.addEventListener('click', onRatingClick);

        $('commentList').addEventListener('click', onCommentClick);
        // Ctrl+Enter trong ô trả lời = gửi
        $('commentList').addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('.reply-box textarea')) {
                e.preventDefault();
                e.target.closest('.reply-box').querySelector('[data-action="send-reply"]').click();
            }
        });

        $('commentSortTabs').addEventListener('click', e => {
            const b = e.target.closest('.sort-tab');
            if (!b || b.dataset.sort === commentSort) return;
            setCommentSort(b.dataset.sort);
            commentPage = 1;
            loadComments();
        });
        $('commentList').addEventListener('error', onCommentImageError, true);   // bắt lỗi ảnh GIF hỏng

        setupTabs();
        renderChapters();
        renderRating();
        renderCommentForm();
        loadComments();
        loadUserState();
        loadRelated();
    }

    // Thanh tab: tự sáng theo phần đang cuộn tới
    function setupTabs() {
        if (!('IntersectionObserver' in window)) return;

        const tabs = [...document.querySelectorAll('#detailTabs a')];
        const setActive = key => tabs.forEach(a => a.classList.toggle('active', a.dataset.tab === key));

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-30% 0px -60% 0px' });

        ['gioi-thieu', 'chuong', 'danh-gia', 'binh-luan'].forEach(key => io.observe($(key)));
    }

    // =====================================================================
    // DANH SÁCH CHƯƠNG
    // =====================================================================
    function renderChapters() {
        const box = $('chapterBox');
        const q = chapterFilter.trim().toLowerCase();

        let items = newestFirst ? [...chapters].reverse() : [...chapters];
        if (q) {
            items = items.filter(c => /^\d+$/.test(q)
                ? String(c.number).startsWith(q)                         // gõ số: khớp theo số chương
                : UI.chapterLabel(c).toLowerCase().includes(q));         // gõ chữ: khớp theo tên chương
        }

        if (!items.length) {
            box.innerHTML = `<div class="p-4 text-center text-muted">${chapters.length ? 'Không có chương nào khớp.' : 'Truyện chưa có chương nào.'}</div>`;
            return;
        }

        box.innerHTML = items.map(c => {
            const created = UI.parseDate(c.createdAt);
            const isNew = created && Date.now() - created.getTime() < NEW_CHAPTER_MS;
            const reading = lastRead && lastRead.chapterId === c.id;

            return `
        <a class="chapter-row ${reading ? 'reading' : ''}" href="/reader.html?id=${c.id}">
          <span class="chapter-name">${esc(UI.chapterLabel(c))}
            ${isNew ? '<span class="tag tag-new">Mới</span>' : ''}
            ${reading ? '<span class="tag tag-reading">Đang đọc dở</span>' : ''}
          </span>
          <span class="chapter-meta">${UI.formatNumber(c.viewCount)} lượt xem · ${UI.formatDate(c.createdAt)}</span>
        </a>`;
        }).join('');
    }

    // =====================================================================
    // THEO DÕI, CHIA SẺ, "ĐỌC TIẾP"
    // =====================================================================
    function paintFollow() {
        const btn = $('followBtn');
        btn.className = following ? 'btn btn-light btn-lg' : 'btn btn-outline-light btn-lg';
        btn.textContent = following ? '✓ Đang theo dõi' : '+ Theo dõi';
    }

    async function toggleFollow() {
        if (!Auth.requireLogin()) return;       // chưa đăng nhập thì chuyển sang trang đăng nhập

        const btn = $('followBtn');
        btn.disabled = true;
        try {
            // Server trả về trạng thái mới, dùng luôn để cập nhật nút và số người theo dõi
            const res = following
                ? await Api.del(`/api/Follows/${id}`)
                : await Api.post(`/api/Follows/${id}`);
            following = res.isFollowing;
            $('followStat').textContent = UI.formatNumber(res.followCount);
            paintFollow();
            UI.toast(following ? 'Đã thêm vào truyện đang theo dõi' : 'Đã bỏ theo dõi truyện');
        } catch (err) {
            UI.toast(err.message, 'danger');
        } finally {
            btn.disabled = false;
        }
    }

    async function share() {
        try {
            if (navigator.share) {
                await navigator.share({ title: comic.title, url: location.href });   // điện thoại: mở bảng chia sẻ
                return;
            }
            await navigator.clipboard.writeText(location.href);                     // máy tính: chép liên kết
            UI.toast('Đã sao chép liên kết truyện');
        } catch (err) {
            if (err && err.name === 'AbortError') return;                           // người dùng tự đóng bảng chia sẻ
            UI.toast('Không sao chép được liên kết', 'danger');
        }
    }

    // Đã đăng nhập thì hỏi server: mình có đang theo dõi không, và đã đọc tới chương nào
    async function loadUserState() {
        if (!me) return;
        try {
            const [status, last] = await Promise.all([
                Api.get(`/api/Follows/${id}/status`),
                Api.get(`/api/History/comics/${id}`),       // chưa đọc thì server trả 204 nên last = null
            ]);

            following = status.isFollowing;
            paintFollow();

            if (last) {
                lastRead = last;
                const label = UI.chapterLabel({ number: last.chapterNumber, title: last.chapterTitle });
                $('readButtons').insertAdjacentHTML('afterbegin',
                    `<a class="btn btn-light btn-lg" href="/reader.html?id=${last.chapterId}">Đọc tiếp: ${esc(label)}</a>`);
                renderChapters();                            // đánh dấu "Đang đọc dở" ở danh sách chương
            }
        } catch {
            /* lỗi thì bỏ qua, các nút vẫn dùng được */
        }
    }

    // =====================================================================
    // CÙNG THỂ LOẠI
    // =====================================================================
    async function loadRelated() {
        const section = $('relatedSection');
        const genre = comic.genres[0];
        if (!genre) return;

        try {
            const data = await Api.get(`/api/Comics?genreId=${genre.id}&pageSize=8&sort=views`);
            const items = data.items.filter(c => c.id !== comic.id).slice(0, 7);
            if (!items.length) return;

            $('relatedTitle').textContent = `Cùng thể loại ${genre.name}`;
            $('relatedRow').innerHTML = items.map(c => UI.posterCard(c)).join('');
            section.classList.remove('d-none');
        } catch {
            /* lỗi thì ẩn mục này, không ảnh hưởng phần còn lại */
        }
    }

    // =====================================================================
    // ĐÁNH GIÁ SAO
    // =====================================================================
    function paintStars(n) {
        document.querySelectorAll('#starInput .star-btn').forEach(b => {
            b.classList.toggle('on', Number(b.dataset.v) <= n);
        });
    }

    function myRatingHtml() {
        if (!me) {
            const back = encodeURIComponent(location.pathname + location.search);
            return `<div class="text-muted">Hãy <a href="/login.html?redirect=${back}">đăng nhập</a> để chấm điểm truyện này.</div>`;
        }

        const buttons = [1, 2, 3, 4, 5].map(v =>
            `<button type="button" class="star-btn" data-v="${v}" aria-label="${v} sao">★</button>`).join('');

        const mine = rating.myRating
            ? `Bạn đã chấm <strong>${rating.myRating}</strong> sao ·
         <button type="button" class="btn btn-link btn-sm p-0 align-baseline" data-action="clear-rating">Xóa đánh giá</button>`
            : 'Chạm vào ngôi sao để chấm điểm';

        return `
      <div class="small text-muted mb-1">Đánh giá của bạn</div>
      <div id="starInput" class="star-input">${buttons}</div>
      <div class="small mt-1">${mine}</div>
      <div id="ratingError" class="small text-danger"></div>`;
    }

    function renderRating() {
        const s = rating;
        const has = s.count > 0;

        // Biểu đồ phân bố từ 5 sao xuống 1 sao
        const bars = has
            ? [5, 4, 3, 2, 1].map(star => {
                const n = s.distribution[star - 1] || 0;
                const pct = Math.round(n / s.count * 100);
                return `
            <div class="d-flex align-items-center gap-2 small mb-1">
              <span class="text-nowrap" style="width:2.4rem">${star} ★</span>
              <div class="progress flex-grow-1" style="height:.6rem">
                <div class="progress-bar bg-warning" style="width:${pct}%"></div>
              </div>
              <span class="text-muted text-end" style="width:2.6rem">${UI.formatNumber(n)}</span>
            </div>`;
            }).join('')
            : '<p class="text-muted mb-0">Chưa có ai đánh giá truyện này. Hãy là người đầu tiên!</p>';

        $('ratingBody').innerHTML = `
      <div class="row g-4 align-items-center rating-block">
        <div class="col-md-3 text-center">
          <div class="rating-big">${has ? s.average.toFixed(1) : '–'}</div>
          <div class="my-1">${UI.stars(s.average)}</div>
          <div class="small text-muted">${has ? `${UI.formatNumber(s.count)} lượt đánh giá` : 'Chưa có đánh giá'}</div>
        </div>
        <div class="col-md-5">${bars}</div>
        <div class="col-md-4">${myRatingHtml()}</div>
      </div>`;

        paintStars(s.myRating || 0);

        // Dòng tóm tắt ở đầu trang
        $('ratingInline').innerHTML = has
            ? `${UI.stars(s.average)} <strong>${s.average.toFixed(1)}</strong> <span class="opacity-75">(${UI.formatNumber(s.count)} đánh giá)</span>`
            : '<span class="opacity-75">Chưa có đánh giá</span>';
    }

    async function onRatingClick(e) {
        const star = e.target.closest('.star-btn');
        const clear = e.target.closest('[data-action="clear-rating"]');
        if (!star && !clear) return;
        if (!Auth.requireLogin()) return;

        const err = $('ratingError');
        if (err) err.textContent = '';

        try {
            // Server trả về tổng hợp mới, dùng luôn để vẽ lại
            rating = clear
                ? await Api.del(`/api/comics/${id}/ratings/mine`)
                : await Api.put(`/api/comics/${id}/ratings/mine`, { stars: Number(star.dataset.v) });
            renderRating();
        } catch (ex) {
            const box = $('ratingError');
            if (box) box.textContent = ex.message;      // ví dụ: "Tài khoản đã bị khóa"
        }
    }

    // =====================================================================
    // BÌNH LUẬN
    // =====================================================================
    function renderCommentForm() {
        const box = $('commentFormBox');

        if (!me) {
            const back = encodeURIComponent(location.pathname + location.search);
            box.innerHTML = `
        <div class="alert alert-light border mb-0">
          Hãy <a href="/login.html?redirect=${back}">đăng nhập</a> để bình luận.
        </div>`;
            return;
        }

        box.innerHTML = `
      <div id="commentError" class="alert alert-danger d-none"></div>
      <textarea id="commentInput" class="form-control mb-2" rows="3" maxlength="1000"
                placeholder="Viết bình luận của bạn..." aria-label="Nội dung bình luận"></textarea>
      <div id="gifPreview" class="mb-2"></div>
      <div class="d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <button id="emojiBtn" type="button" class="btn btn-sm btn-outline-secondary" title="Chèn emoji">😊</button>
          <button id="gifBtn" type="button" class="btn btn-sm btn-outline-secondary" title="Chèn ảnh GIF">GIF</button>
          <small class="text-muted"><span id="commentLen">0</span>/1000</small>
        </div>
        <button id="commentSend" type="button" class="btn btn-warning btn-sm">Gửi bình luận</button>
      </div>
      <div id="emojiPanel" class="picker-panel d-none">
        <div class="emoji-grid">
          ${EMOJIS.map(e => `<button type="button" class="emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      </div>
      <div id="gifPanel" class="picker-panel d-none">
        <div class="small text-muted mb-2">Thư viện GIF</div>
        <div class="gif-grid">
          ${GIF_LIBRARY.map(g => `
            <button type="button" class="gif-item" data-url="${g.url}" title="${g.label}">
              <img src="${g.url}" alt="${g.label}" loading="lazy">
            </button>`).join('')}
        </div>
        <div class="small text-muted mt-3 mb-1">Hoặc dán link GIF (Giphy, Tenor)</div>
        <div class="input-group input-group-sm">
          <input id="gifUrlInput" class="form-control" placeholder="https://media.giphy.com/.../giphy.gif">
          <button id="gifUrlUse" type="button" class="btn btn-outline-secondary" aria-label="Link ảnh GIF">Dùng</button>
        </div>
        <div id="gifUrlError" class="small text-danger mt-1"></div>
      </div>`;

        $('commentInput').addEventListener('input', e => {
            $('commentLen').textContent = e.target.value.length;
        });
        $('commentSend').addEventListener('click', sendComment);

        // Mọi nút trong khung soạn bình luận xử lý chung ở đây
        box.addEventListener('click', e => {
            if (e.target.closest('#emojiBtn')) return togglePanel('emojiPanel');
            if (e.target.closest('#gifBtn')) return togglePanel('gifPanel');

            const emoji = e.target.closest('.emoji-btn');
            if (emoji) return insertAtCursor(emoji.dataset.emoji);

            const gif = e.target.closest('.gif-item');
            if (gif) {
                selectGif(gif.dataset.url);
                return togglePanel(null);
            }

            if (e.target.closest('#gifUrlUse')) return useGifLink();
            if (e.target.closest('[data-action="remove-gif"]')) return selectGif(null);
        });
    }

    // Mở một bảng và đóng bảng còn lại. togglePanel(null) là đóng hết
    function togglePanel(name) {
        ['emojiPanel', 'gifPanel'].forEach(p => {
            const el = $(p);
            if (!el) return;
            el.classList.toggle('d-none', p !== name || !el.classList.contains('d-none'));
        });
    }

    // Chèn emoji vào đúng vị trí con trỏ
    function insertAtCursor(text) {
        const input = $('commentInput');
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const next = input.value.slice(0, start) + text + input.value.slice(end);
        if (next.length > input.maxLength) return;          // quá 1000 ký tự thì bỏ qua

        input.value = next;
        const pos = start + text.length;
        input.setSelectionRange(pos, pos);
        input.focus();
        $('commentLen').textContent = input.value.length;
    }

    function selectGif(url) {
        selectedGif = url;
        $('gifPreview').innerHTML = url
            ? `<div class="gif-preview">
           <img src="${esc(url)}" alt="GIF đã chọn">
           <button type="button" class="btn-close" data-action="remove-gif" aria-label="Bỏ GIF"></button>
         </div>`
            : '';
    }

    function useGifLink() {
        const input = $('gifUrlInput');
        const err = $('gifUrlError');
        const url = input.value.trim();

        if (!EXTERNAL_GIF.test(url)) {
            err.textContent = 'Link không hợp lệ. Chỉ nhận link https từ Giphy hoặc Tenor có đuôi .gif hoặc .webp';
            return;
        }
        err.textContent = '';
        input.value = '';
        selectGif(url);
        togglePanel(null);
    }

    function showCommentError(text) {
        const box = $('commentError');
        box.textContent = text;
        box.classList.remove('d-none');
    }

    async function sendComment() {
        const input = $('commentInput');
        const btn = $('commentSend');
        $('commentError').classList.add('d-none');

        const content = input.value.trim();
        if (!content && !selectedGif) return showCommentError('Hãy nhập nội dung hoặc chọn một ảnh GIF');

        btn.disabled = true;
        try {
            await Api.post(`/api/comics/${id}/comments`, { content, gifUrl: selectedGif });
            input.value = '';
            $('commentLen').textContent = '0';
            selectGif(null);
            togglePanel(null);
            commentPage = 1;                 // bình luận mới nằm ở trang đầu
            setCommentSort('newest');
            await loadComments();
            UI.toast('Đã gửi bình luận');
        } catch (err) {
            showCommentError(err.message);   // ví dụ: "Tài khoản đã bị khóa"
        } finally {
            btn.disabled = false;
        }
    }

    // ---------- Hiển thị bình luận, phản hồi, lượt thích ----------
    function setCommentSort(sort) {
        commentSort = sort;
        document.querySelectorAll('#commentSortTabs .sort-tab').forEach(t => {
            const on = t.dataset.sort === sort;
            t.classList.toggle('active', on);
            t.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    // Cập nhật mọi chỗ hiện tổng số bình luận (tiêu đề, ô thống kê, tab)
    function setCommentTotal(n) {
        commentTotal = Math.max(0, n);
        const text = UI.formatNumber(commentTotal);
        ['commentCount', 'commentStat', 'tabComments'].forEach(elId => {
            if ($(elId)) $(elId).textContent = text;
        });
    }

    function likeBtnHtml(c) {
        return `
      <button type="button" class="cmt-act cmt-like ${c.likedByMe ? 'liked' : ''}" data-action="like"
              aria-pressed="${c.likedByMe ? 'true' : 'false'}" aria-label="Thích bình luận">
        <span class="heart" aria-hidden="true">${c.likedByMe ? '♥' : '♡'}</span>
        Thích<span class="like-count">${c.likeCount > 0 ? ` (${UI.formatNumber(c.likeCount)})` : ''}</span>
      </button>`;
    }

    function paintLike(btn, liked, count) {
        btn.classList.toggle('liked', liked);
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        btn.querySelector('.heart').textContent = liked ? '♥' : '♡';
        btn.querySelector('.like-count').textContent = count > 0 ? ` (${UI.formatNumber(count)})` : '';

        if (liked) {                                  // hiệu ứng nảy nhẹ khi vừa thích
            btn.classList.remove('pop');
            void btn.offsetWidth;                       // buộc trình duyệt tính lại để chạy lại hiệu ứng
            btn.classList.add('pop');
        }
    }

    // Một bình luận (gốc hoặc phản hồi)
    function commentHtml(c, isReply = false) {
        // Chỉ để ẩn/hiện nút Xóa cho gọn. Việc chặn thật sự do server quyết định
        const canDelete = me && (me.id === c.userId || me.role === 'Admin');
        const text = c.content || '';
        const onlyEmoji = text.length > 0 && /^[\p{Extended_Pictographic}\u200d\ufe0f\s]+$/u.test(text);
        const mention = c.replyToUsername ? `<span class="cmt-mention">@${esc(c.replyToUsername)}</span> ` : '';

        return `
      <div class="cmt ${isReply ? 'cmt-reply' : ''}" data-id="${c.id}" data-user="${esc(c.username)}">
        <div class="avatar ${isReply ? 'avatar-sm' : ''}">${esc((c.username || '?').charAt(0).toUpperCase())}</div>
        <div class="flex-grow-1 comment-body">
          <div>
            <strong>${esc(c.username)}</strong>
            <span class="small text-muted ms-1">${UI.timeAgo(c.createdAt)}</span>
          </div>
          ${(text || mention) ? `<div class="comment-text ${onlyEmoji && !mention ? 'comment-emoji-only' : ''}">${mention}${esc(text)}</div>` : ''}
          ${c.gifUrl ? `<img class="comment-gif" src="${esc(c.gifUrl)}" alt="GIF" loading="lazy">` : ''}
          <div class="cmt-actions">
            ${likeBtnHtml(c)}
            <button type="button" class="cmt-act" data-action="reply">Trả lời</button>
            ${canDelete ? '<button type="button" class="cmt-act cmt-danger" data-action="delete-comment">Xóa</button>' : ''}
          </div>
        </div>
      </div>`;
    }

    function repliesInnerHtml(items, hidden) {
        return items.map(r => commentHtml(r, true)).join('') +
            (hidden > 0
                ? `<button type="button" class="btn btn-link btn-sm px-0" data-action="more-replies">
             Xem thêm ${UI.formatNumber(hidden)} phản hồi</button>`
                : '');
    }

    // Một chủ đề = bình luận gốc + vài phản hồi đầu + chỗ để mở ô trả lời
    function threadHtml(c) {
        const shown = c.replies || [];
        return `
      <div class="thread" data-thread="${c.id}" data-replies="${c.replyCount}">
        ${commentHtml(c)}
        <div class="thread-replies" ${c.replyCount ? '' : 'hidden'}>
          ${repliesInnerHtml(shown, c.replyCount - shown.length)}
        </div>
        <div class="reply-slot"></div>
      </div>`;
    }

    async function loadComments() {
        const list = $('commentList');
        try {
            const data = await Api.get(
                `/api/comics/${id}/comments?page=${commentPage}&pageSize=${COMMENT_PAGE_SIZE}&sort=${commentSort}`);

            // Xóa hết bình luận ở trang cuối thì lùi về trang trước
            if (data.items.length === 0 && data.totalItems > 0 && commentPage > 1) {
                commentPage = data.totalPages;
                return loadComments();
            }

            setCommentTotal(data.totalComments);

            list.innerHTML = data.items.length
                ? data.items.map(threadHtml).join('')
                : '<p class="text-muted mb-0">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';

            UI.renderPagination($('commentPager'), data.page, data.totalPages, p => {
                commentPage = p;
                loadComments();
            });
        } catch (err) {
            list.innerHTML = `<div class="alert alert-danger mb-0">${esc(err.message)}</div>`;
        }
    }

    // Tải lại TOÀN BỘ phản hồi của một chủ đề (tối đa 20 trang x 50) rồi vẽ lại phần phản hồi
    async function refreshThread(thread) {
        const rootId = thread.dataset.thread;
        const all = [];
        let page = 1;
        let total = 0;

        do {
            const res = await Api.get(`/api/comments/${rootId}/replies?page=${page}&pageSize=50`);
            all.push(...res.items);
            total = res.totalItems;
            page++;
        } while (all.length < total && page <= 20);

        thread.dataset.replies = total;
        const box = thread.querySelector('.thread-replies');
        box.hidden = all.length === 0;
        box.innerHTML = repliesInnerHtml(all, Math.max(0, total - all.length));
    }

    // Mở ô trả lời dưới chủ đề; target là bình luận (gốc hoặc phản hồi) đang được trả lời
    function openReplyBox(thread, target) {
        const slot = thread.querySelector('.reply-slot');
        slot.innerHTML = `
      <div class="reply-box" data-target="${target.dataset.id}">
        <div class="small text-muted mb-1">Trả lời <strong>${esc(target.dataset.user)}</strong></div>
        <div class="reply-error small text-danger mb-1"></div>
        <textarea class="form-control form-control-sm" rows="2" maxlength="1000"
                  aria-label="Nội dung trả lời" placeholder="Viết câu trả lời... (Ctrl+Enter để gửi)"></textarea>
        <div class="d-flex justify-content-end gap-2 mt-2">
          <button type="button" class="btn btn-sm btn-pill-outline" data-action="cancel-reply">Hủy</button>
          <button type="button" class="btn btn-sm btn-brand" data-action="send-reply">Gửi</button>
        </div>
      </div>`;
        slot.querySelector('textarea').focus();
    }

    async function sendReply(thread, btn) {
        const box = thread.querySelector('.reply-box');
        const input = box.querySelector('textarea');
        const err = box.querySelector('.reply-error');
        err.textContent = '';

        const content = input.value.trim();
        if (!content) { err.textContent = 'Hãy nhập nội dung trả lời'; return; }

        btn.disabled = true;
        try {
            await Api.post(`/api/comics/${id}/comments`, { content, parentId: Number(box.dataset.target) });
            thread.querySelector('.reply-slot').innerHTML = '';
            setCommentTotal(commentTotal + 1);
            await refreshThread(thread);
            UI.toast('Đã gửi trả lời');
        } catch (ex) {
            err.textContent = ex.message;       // ví dụ: "Tài khoản đã bị khóa"
            btn.disabled = false;
        }
    }

    async function onCommentClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const cmt = btn.closest('.cmt');          // bình luận chứa nút (không có với nút Hủy/Gửi/Xem thêm)
        const thread = btn.closest('.thread');

        try {
            if (action === 'like') {
                if (!Auth.requireLogin()) return;
                const wantLike = btn.getAttribute('aria-pressed') !== 'true';
                btn.disabled = true;
                try {
                    const res = wantLike
                        ? await Api.put(`/api/comments/${cmt.dataset.id}/like`)
                        : await Api.del(`/api/comments/${cmt.dataset.id}/like`);
                    paintLike(btn, res.liked, res.likeCount);
                } finally {
                    btn.disabled = false;
                }
                return;
            }

            if (action === 'reply') {
                if (!Auth.requireLogin()) return;
                const slot = thread.querySelector('.reply-slot');
                const open = slot.querySelector('.reply-box');
                if (open && open.dataset.target === cmt.dataset.id) { slot.innerHTML = ''; return; }   // bấm lần nữa = đóng
                openReplyBox(thread, cmt);
                return;
            }

            if (action === 'cancel-reply') { thread.querySelector('.reply-slot').innerHTML = ''; return; }
            if (action === 'send-reply') return sendReply(thread, btn);

            if (action === 'more-replies') {
                btn.disabled = true;
                await refreshThread(thread);
                return;
            }

            if (action === 'delete-comment') {
                const isReply = cmt.classList.contains('cmt-reply');
                const n = Number(thread.dataset.replies) || 0;
                const msg = isReply ? 'Xóa phản hồi này?'
                    : n > 0 ? `Xóa bình luận này và ${n} phản hồi của nó?`
                        : 'Xóa bình luận này?';
                if (!confirm(msg)) return;

                await Api.del('/api/comments/' + cmt.dataset.id);
                if (isReply) {
                    setCommentTotal(commentTotal - 1);
                    await refreshThread(thread);
                } else {
                    await loadComments();               // tổng số được server tính lại, kể cả các phản hồi bị xóa theo
                }
                UI.toast('Đã xóa');
            }
        } catch (err) {
            UI.toast(err.message, 'danger');
        }
    }

    // GIF bị hỏng link (không tải được): thay bằng dòng chữ thay vì để ảnh vỡ
    function onCommentImageError(e) {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.classList.contains('comment-gif')) return;

        const note = document.createElement('div');
        note.className = 'small text-muted fst-italic';
        note.textContent = '[Không tải được ảnh GIF]';
        img.replaceWith(note);
    }
})();