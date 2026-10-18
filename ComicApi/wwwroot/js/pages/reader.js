(() => {
    const root = document.getElementById('readerRoot');
    const id = parseInt(new URLSearchParams(location.search).get('id'));

    let chapter = null;

    const go = chapterId => { location.href = 'reader.html?id=' + chapterId; };

    const notFound = text => `
    <div class="text-center py-5">
      <h4 class="mb-3">${UI.escapeHtml(text)}</h4>
      <a class="btn btn-warning" href="index.html">Về trang chủ</a>
    </div>`;

    if (!id) {
        root.innerHTML = notFound('Không tìm thấy chương');
        return;
    }

    // Hàng nút: Chương trước | danh sách chương | Chương sau
    function controlsHtml(ch) {
        const prev = ch.prevChapterId
            ? `<a class="btn btn-warning" href="reader.html?id=${ch.prevChapterId}">← Chương trước</a>`
            : '<span class="btn btn-secondary disabled">← Chương trước</span>';
        const next = ch.nextChapterId
            ? `<a class="btn btn-warning" href="reader.html?id=${ch.nextChapterId}">Chương sau →</a>`
            : '<span class="btn btn-secondary disabled">Chương sau →</span>';

        return `
      <div class="d-flex gap-2 justify-content-center align-items-center flex-wrap my-3">
        ${prev}
        <select class="form-select w-auto chapter-select" style="max-width: 260px">
          <option value="${ch.id}">${UI.escapeHtml(UI.chapterLabel(ch))}</option>
        </select>
        ${next}
      </div>`;
    }

    function render(ch) {
        const label = UI.chapterLabel(ch);
        document.title = `${ch.comicTitle} - ${label} - ComicHub`;

        const images = ch.images.length
            ? ch.images.map((im, i) =>
                `<img src="${UI.escapeHtml(im.imageUrl)}" alt="Trang ${i + 1}" loading="lazy"
                onerror="this.onerror=null;this.src=UI.placeholder">`).join('')
            : '<div class="text-center text-secondary py-5">Chương này chưa có ảnh.</div>';

        root.innerHTML = `
      <nav class="small mb-2">
        <a class="breadcrumb-link" href="index.html">Trang chủ</a> /
        <a class="breadcrumb-link" href="comic.html?id=${ch.comicId}">${UI.escapeHtml(ch.comicTitle)}</a> /
        <span>${UI.escapeHtml(label)}</span>
      </nav>

      <h4 class="text-center mb-1">${UI.escapeHtml(ch.comicTitle)}</h4>
      <div class="text-center text-secondary">${UI.escapeHtml(label)}</div>

      ${controlsHtml(ch)}
      <div class="reader-images">${images}</div>
      ${controlsHtml(ch)}

      <p class="text-center small text-secondary">Mẹo: dùng phím ← → để đổi chương</p>`;
    }

    // Điền đầy đủ các chương vào ô chọn (làm sau để ảnh được hiển thị ngay, không phải chờ)
    async function fillChapterSelect(ch) {
        try {
            const list = await Api.get(`/api/Comics/${ch.comicId}/chapters`);
            const options = list.map(c =>
                `<option value="${c.id}" ${c.id === ch.id ? 'selected' : ''}>${UI.escapeHtml(UI.chapterLabel(c))}</option>`
            ).join('');
            document.querySelectorAll('.chapter-select').forEach(sel => { sel.innerHTML = options; });
        } catch {
            /* không tải được danh sách thì ô chọn chỉ hiện chương hiện tại */
        }
    }

    // Tăng lượt xem, mỗi chương chỉ tính 1 lần trong một phiên (tab) để F5 không làm tăng ảo
    function countView(chapterId) {
        const key = 'viewed_' + chapterId;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        Api.post(`/api/Chapters/${chapterId}/view`).catch(() => { /* lỗi thì bỏ qua */ });
    }

    // Chọn chương trong ô danh sách thì chuyển sang chương đó
    root.addEventListener('change', e => {
        if (e.target.classList.contains('chapter-select')) go(e.target.value);
    });

    // Phím tắt ← → để đổi chương
    document.addEventListener('keydown', e => {
        if (!chapter || e.target.closest('input, select, textarea')) return;
        if (e.key === 'ArrowLeft' && chapter.prevChapterId) go(chapter.prevChapterId);
        if (e.key === 'ArrowRight' && chapter.nextChapterId) go(chapter.nextChapterId);
    });

    (async function init() {
        root.innerHTML = `<div class="row">${UI.spinner()}</div>`;
        try {
            chapter = await Api.get('/api/Chapters/' + id);
            render(chapter);
            fillChapterSelect(chapter);
            countView(chapter.id);
            // Giai đoạn 7: lưu lịch sử đọc của người dùng sẽ thêm ở đây
        } catch (err) {
            root.innerHTML = err.status === 404
                ? notFound('Không tìm thấy chương')
                : `<div class="row">${UI.message(err.message)}</div>`;
        }
    })();
})();