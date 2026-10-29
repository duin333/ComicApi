(() => {
    const root = document.getElementById('comicRoot');
    const id = parseInt(new URLSearchParams(location.search).get('id'));
    const COMMENT_PAGE_SIZE = 10;
    const $ = elId => document.getElementById(elId);

    const me = Auth.isLoggedIn() ? Auth.getUser() : null;   // người đang đăng nhập (nếu có)

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

    let chapters = [];            // sắp theo số chương tăng dần (đúng như server trả về)
    let newestFirst = true;       // hiển thị chương mới nhất lên đầu
    let following = false;        // tôi có đang theo dõi truyện này không
    let rating = emptySummary();  // tổng hợp đánh giá của truyện
    let commentPage = 1;
    let selectedGif = null;       // GIF đang chọn cho bình luận sắp gửi

    const notFound = text => `
    <div class="text-center py-5">
      <h4 class="mb-3">${UI.escapeHtml(text)}</h4>
      <a class="btn btn-warning" href="index.html">Về trang chủ</a>
    </div>`;

    // Thiếu hoặc sai ?id= trên địa chỉ
    if (!id) {
        root.innerHTML = notFound('Không tìm thấy truyện');
        return;
    }

    (async function init() {
        root.innerHTML = `<div class="row">${UI.spinner()}</div>`;
        try {
            // Gọi 3 API cùng lúc cho nhanh. Đánh giá lỗi thì vẫn hiện trang với đánh giá trống
            const [comic, list, summary] = await Promise.all([
                Api.get('/api/Comics/' + id),
                Api.get(`/api/Comics/${id}/chapters`),
                Api.get(`/api/comics/${id}/ratings`).catch(() => emptySummary()),
            ]);
            chapters = list;
            rating = summary;
            render(comic);
        } catch (err) {
            root.innerHTML = err.status === 404
                ? notFound('Không tìm thấy truyện')
                : `<div class="row">${UI.message(err.message)}</div>`;
        }
    })();

    // ---------- Dựng trang ----------
    function render(comic) {
        document.title = `${comic.title} - ComicHub`;

        const cover = comic.coverUrl ? UI.escapeHtml(comic.coverUrl) : UI.placeholder;
        const done = comic.status === 'Completed';

        const genres = comic.genres.map(g =>
            `<a class="badge text-bg-secondary text-decoration-none me-1"
          href="index.html?genreId=${g.id}">${UI.escapeHtml(g.name)}</a>`).join('');

        const stat = (value, label, elId) => `
      <div class="col">
        <div class="bg-white rounded shadow-sm p-2">
          <div class="fw-bold" ${elId ? `id="${elId}"` : ''}>${UI.formatNumber(value)}</div>
          <div class="small text-muted">${label}</div>
        </div>
      </div>`;

        const first = chapters[0];
        const last = chapters[chapters.length - 1];
        const readButtons = chapters.length
            ? `<a class="btn btn-warning" href="reader.html?id=${first.id}">Đọc từ đầu</a>
         <a class="btn btn-outline-dark" href="reader.html?id=${last.id}">Chương mới nhất</a>`
            : '<button class="btn btn-secondary" disabled>Chưa có chương</button>';

        root.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-md-4 col-lg-3">
          <div class="cover-wrap shadow-sm rounded">
            <img src="${cover}" alt="${UI.escapeHtml(comic.title)}"
                 onerror="this.onerror=null;this.src=UI.placeholder">
          </div>
        </div>

        <div class="col-12 col-md-8 col-lg-9">
          <h2 class="mb-2">${UI.escapeHtml(comic.title)}</h2>
          <div class="mb-2">
            <span class="badge ${done ? 'text-bg-success' : 'text-bg-primary'}">${done ? 'Hoàn thành' : 'Đang ra'}</span>
            <span class="text-muted ms-2">Tác giả: ${UI.escapeHtml(comic.author || 'Đang cập nhật')}</span>
            <span class="text-muted ms-2">· Cập nhật ${UI.timeAgo(comic.updatedAt)}</span>
            <span id="ratingInline" class="ms-2"></span>
          </div>
          <div class="mb-3">${genres}</div>

          <div class="row row-cols-2 row-cols-sm-4 g-2 mb-3 text-center">
            ${stat(comic.viewCount, 'Lượt xem')}
            ${stat(chapters.length, 'Chương')}
            ${stat(comic.followCount, 'Theo dõi', 'followStat')}
            ${stat(comic.commentCount, 'Bình luận', 'commentStat')}
          </div>

          <h6 class="text-uppercase text-muted">Giới thiệu</h6>
          <p class="comic-description">${UI.escapeHtml(comic.description || 'Chưa có mô tả.')}</p>

          <div id="readButtons" class="d-flex gap-2 flex-wrap">
            ${readButtons}
            <button id="followBtn" type="button" class="btn btn-outline-dark">+ Theo dõi</button>
          </div>
        </div>
      </div>

      <div id="ratingCard" class="card shadow-sm border-0 mt-4">
        <div class="card-header bg-white"><strong>Đánh giá</strong></div>
        <div id="ratingBody" class="card-body"></div>
      </div>

      <div class="card shadow-sm border-0 mt-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <strong>Danh sách chương (${chapters.length})</strong>
          <button id="sortBtn" type="button" class="btn btn-sm btn-outline-secondary">Mới nhất trước</button>
        </div>
        <div id="chapterBox" class="list-group list-group-flush chapter-scroll"></div>
      </div>

      <div class="card shadow-sm border-0 mt-4">
        <div class="card-header bg-white">
          <strong>Bình luận (<span id="commentCount">${UI.formatNumber(comic.commentCount)}</span>)</strong>
        </div>
        <div class="card-body">
          <div id="commentFormBox" class="mb-3"></div>
          <div id="commentList"></div>
          <div id="commentPager" class="mt-3"></div>
        </div>
      </div>`;

        const sortBtn = $('sortBtn');
        sortBtn.addEventListener('click', () => {
            newestFirst = !newestFirst;
            sortBtn.textContent = newestFirst ? 'Mới nhất trước' : 'Cũ nhất trước';
            renderChapters();
        });
        renderChapters();

        $('followBtn').addEventListener('click', toggleFollow);

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
        renderRating();

        $('commentList').addEventListener('click', onCommentClick);
        $('commentList').addEventListener('error', onCommentImageError, true);   // bắt lỗi ảnh GIF hỏng
        renderCommentForm();
        loadComments();
        loadUserState();
    }

    function renderChapters() {
        const box = $('chapterBox');
        const items = newestFirst ? [...chapters].reverse() : chapters;

        box.innerHTML = items.length
            ? items.map(c => `
          <a class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
             href="reader.html?id=${c.id}">
            <span>${UI.escapeHtml(UI.chapterLabel(c))}</span>
            <span class="small text-muted text-nowrap ms-3">
              ${UI.formatNumber(c.viewCount)} lượt xem · ${UI.formatDate(c.createdAt)}
            </span>
          </a>`).join('')
            : '<div class="list-group-item text-muted">Truyện chưa có chương nào.</div>';
    }

    // ---------- Theo dõi và "Đọc tiếp" ----------
    function paintFollow() {
        const btn = $('followBtn');
        btn.className = following ? 'btn btn-dark' : 'btn btn-outline-dark';
        btn.textContent = following ? '✓ Đang theo dõi' : '+ Theo dõi';
    }

    async function toggleFollow() {
        if (!Auth.requireLogin()) return;       // chưa đăng nhập thì chuyển sang trang đăng nhập

        const btn = $('followBtn');
        btn.disabled = true;
        try {
            const res = following
                ? await Api.del(`/api/Follows/${id}`)
                : await Api.post(`/api/Follows/${id}`);
            following = res.isFollowing;
            $('followStat').textContent = UI.formatNumber(res.followCount);
            paintFollow();
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
        }
    }

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
                const label = UI.chapterLabel({ number: last.chapterNumber, title: last.chapterTitle });
                $('readButtons').insertAdjacentHTML('afterbegin',
                    `<a class="btn btn-success" href="reader.html?id=${last.chapterId}">Đọc tiếp: ${UI.escapeHtml(label)}</a>`);
            }
        } catch {
            /* lỗi thì bỏ qua, các nút vẫn dùng được */
        }
    }

    // ---------- Đánh giá sao ----------
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

        // Dòng tóm tắt cạnh tên tác giả
        $('ratingInline').innerHTML = has
            ? `· ${UI.stars(s.average)} <span class="text-muted">${s.average.toFixed(1)} (${UI.formatNumber(s.count)})</span>`
            : '<span class="text-muted">· Chưa có đánh giá</span>';
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

    // ---------- Bình luận ----------
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
                placeholder="Viết bình luận của bạn..."></textarea>
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
          <button id="gifUrlUse" type="button" class="btn btn-outline-secondary">Dùng</button>
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
           <img src="${UI.escapeHtml(url)}" alt="GIF đã chọn">
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
            await loadComments();
        } catch (err) {
            showCommentError(err.message);   // ví dụ: "Tài khoản đã bị khóa"
        } finally {
            btn.disabled = false;
        }
    }

    function commentHtml(c) {
        // Chỉ để ẩn/hiện nút Xóa cho gọn. Việc chặn thật sự do server quyết định
        const canDelete = me && (me.id === c.userId || me.role === 'Admin');
        const text = c.content || '';

        // Bình luận chỉ có emoji thì hiện chữ to hơn
        const onlyEmoji = text.length > 0 && /^[\p{Extended_Pictographic}\u200d\ufe0f\s]+$/u.test(text);

        return `
      <div class="d-flex gap-3 py-3 border-bottom" data-id="${c.id}">
        <div class="avatar">${UI.escapeHtml((c.username || '?').charAt(0).toUpperCase())}</div>
        <div class="flex-grow-1 comment-body">
          <div>
            <strong>${UI.escapeHtml(c.username)}</strong>
            <span class="small text-muted ms-1">${UI.timeAgo(c.createdAt)}</span>
          </div>
          ${text ? `<div class="comment-text ${onlyEmoji ? 'comment-emoji-only' : ''}">${UI.escapeHtml(text)}</div>` : ''}
          ${c.gifUrl ? `<img class="comment-gif" src="${UI.escapeHtml(c.gifUrl)}" alt="GIF" loading="lazy">` : ''}
        </div>
        ${canDelete
                ? '<button type="button" class="btn btn-sm btn-outline-danger align-self-start" data-action="delete-comment">Xóa</button>'
                : ''}
      </div>`;
    }

    async function loadComments() {
        const list = $('commentList');
        try {
            const data = await Api.get(
                `/api/comics/${id}/comments?page=${commentPage}&pageSize=${COMMENT_PAGE_SIZE}`);

            // Xóa hết bình luận ở trang cuối thì lùi về trang trước
            if (data.items.length === 0 && data.totalItems > 0 && commentPage > 1) {
                commentPage = data.totalPages;
                return loadComments();
            }

            $('commentCount').textContent = UI.formatNumber(data.totalItems);
            $('commentStat').textContent = UI.formatNumber(data.totalItems);

            list.innerHTML = data.items.length
                ? data.items.map(commentHtml).join('')
                : '<p class="text-muted mb-0">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';

            UI.renderPagination($('commentPager'), data.page, data.totalPages, p => {
                commentPage = p;
                loadComments();
            });
        } catch (err) {
            list.innerHTML = `<div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div>`;
        }
    }

    async function onCommentClick(e) {
        const btn = e.target.closest('button[data-action="delete-comment"]');
        if (!btn) return;
        if (!confirm('Xóa bình luận này?')) return;

        const commentId = btn.closest('[data-id]').dataset.id;
        try {
            await Api.del('/api/comments/' + commentId);
            await loadComments();
        } catch (err) {
            alert(err.message);
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