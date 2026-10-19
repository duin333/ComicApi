(() => {
    const root = document.getElementById('comicRoot');
    const id = parseInt(new URLSearchParams(location.search).get('id'));
    const COMMENT_PAGE_SIZE = 10;
    const $ = elId => document.getElementById(elId);

    const me = Auth.isLoggedIn() ? Auth.getUser() : null;   // người đang đăng nhập (nếu có)

    let chapters = [];        // sắp theo số chương tăng dần (đúng như server trả về)
    let newestFirst = true;   // hiển thị chương mới nhất lên đầu
    let following = false;    // tôi có đang theo dõi truyện này không
    let commentPage = 1;

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
            // Gọi 2 API cùng lúc cho nhanh
            const [comic, list] = await Promise.all([
                Api.get('/api/Comics/' + id),
                Api.get(`/api/Comics/${id}/chapters`),
            ]);
            chapters = list;
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
        $('commentList').addEventListener('click', onCommentClick);
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
            // Server trả về trạng thái mới, dùng luôn để cập nhật nút và số người theo dõi
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
                const label = UI.chapterLabel({ number: last.chapterNumber, title: last.chapterTitle });
                $('readButtons').insertAdjacentHTML('afterbegin',
                    `<a class="btn btn-success" href="reader.html?id=${last.chapterId}">Đọc tiếp: ${UI.escapeHtml(label)}</a>`);
            }
        } catch {
            /* lỗi thì bỏ qua, các nút vẫn dùng được */
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
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted"><span id="commentLen">0</span>/1000</small>
        <button id="commentSend" type="button" class="btn btn-warning btn-sm">Gửi bình luận</button>
      </div>`;

        $('commentInput').addEventListener('input', e => {
            $('commentLen').textContent = e.target.value.length;
        });
        $('commentSend').addEventListener('click', sendComment);
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
        if (!content) return showCommentError('Vui lòng nhập nội dung bình luận');

        btn.disabled = true;
        try {
            await Api.post(`/api/comics/${id}/comments`, { content });
            input.value = '';
            $('commentLen').textContent = '0';
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
        return `
      <div class="d-flex gap-3 py-3 border-bottom" data-id="${c.id}">
        <div class="avatar">${UI.escapeHtml((c.username || '?').charAt(0).toUpperCase())}</div>
        <div class="flex-grow-1">
          <div>
            <strong>${UI.escapeHtml(c.username)}</strong>
            <span class="small text-muted ms-1">${UI.timeAgo(c.createdAt)}</span>
          </div>
          <div class="comment-text">${UI.escapeHtml(c.content)}</div>
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
})();