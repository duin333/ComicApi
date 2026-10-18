(() => {
    const root = document.getElementById('comicRoot');
    const id = parseInt(new URLSearchParams(location.search).get('id'));

    let chapters = [];        // sắp theo số chương tăng dần (đúng như server trả về)
    let newestFirst = true;   // hiển thị chương mới nhất lên đầu

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

    function render(comic) {
        document.title = `${comic.title} - ComicHub`;

        const cover = comic.coverUrl ? UI.escapeHtml(comic.coverUrl) : UI.placeholder;
        const done = comic.status === 'Completed';

        const genres = comic.genres.map(g =>
            `<a class="badge text-bg-secondary text-decoration-none me-1"
          href="index.html?genreId=${g.id}">${UI.escapeHtml(g.name)}</a>`).join('');

        const stat = (value, label) => `
      <div class="col">
        <div class="bg-white rounded shadow-sm p-2">
          <div class="fw-bold">${UI.formatNumber(value)}</div>
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
            ${stat(comic.followCount, 'Theo dõi')}
            ${stat(comic.commentCount, 'Bình luận')}
          </div>

          <h6 class="text-uppercase text-muted">Giới thiệu</h6>
          <p class="comic-description">${UI.escapeHtml(comic.description || 'Chưa có mô tả.')}</p>

          <div class="d-flex gap-2 flex-wrap">${readButtons}</div>
        </div>
      </div>

      <div class="card shadow-sm border-0 mt-4">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <strong>Danh sách chương (${chapters.length})</strong>
          <button id="sortBtn" type="button" class="btn btn-sm btn-outline-secondary">Mới nhất trước</button>
        </div>
        <div id="chapterBox" class="list-group list-group-flush chapter-scroll"></div>
      </div>`;

        const sortBtn = document.getElementById('sortBtn');
        sortBtn.addEventListener('click', () => {
            newestFirst = !newestFirst;
            sortBtn.textContent = newestFirst ? 'Mới nhất trước' : 'Cũ nhất trước';
            renderChapters();
        });

        renderChapters();
    }

    function renderChapters() {
        const box = document.getElementById('chapterBox');
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
})();