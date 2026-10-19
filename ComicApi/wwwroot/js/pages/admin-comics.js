(() => {
    // Không phải Admin thì dừng, không chạy gì thêm
    if (!Admin.guard()) return;
    Admin.renderNav('comics');

    const PAGE_SIZE = 10;
    const $ = id => document.getElementById(id);

    const tbody = $('comicRows');
    const pager = $('pager');
    const totalText = $('totalText');
    const searchForm = $('searchForm');
    const searchInput = $('searchInput');

    const modal = new bootstrap.Modal($('comicModal'));
    const form = $('comicForm');
    const formAlert = $('formAlert');
    const saveBtn = $('saveBtn');
    const modalTitle = $('modalTitle');
    const coverFile = $('coverFile');
    const coverPreview = $('coverPreview');
    const genreChecks = $('genreChecks');

    const state = { keyword: '', page: 1 };
    let editingId = null;     // null nghĩa là đang thêm mới
    let coverUrl = null;      // đường dẫn ảnh bìa hiện tại
    let pendingFile = null;   // ảnh mới vừa chọn, chờ bấm Lưu mới tải lên
    let reqId = 0;

    // ---------- Danh sách ----------
    function rowHtml(c) {
        const cover = c.coverUrl ? UI.escapeHtml(c.coverUrl) : UI.placeholder;
        const done = c.status === 'Completed';
        const genres = c.genres
            .map(g => `<span class="badge text-bg-secondary me-1">${UI.escapeHtml(g)}</span>`).join('');

        return `
      <tr data-id="${c.id}">
        <td><img class="admin-thumb" src="${cover}" alt=""
                 onerror="this.onerror=null;this.src=UI.placeholder"></td>
        <td>
          <div class="fw-semibold">${UI.escapeHtml(c.title)}</div>
          <div class="small text-muted">${UI.escapeHtml(c.author || '')}</div>
        </td>
        <td>${genres}</td>
        <td><span class="badge ${done ? 'text-bg-success' : 'text-bg-primary'}">${done ? 'Hoàn thành' : 'Đang ra'}</span></td>
        <td class="text-nowrap"><a href="/admin/chapters.html?comicId=${c.id}">${c.chapterCount} chương</a></td>
        <td class="text-end">${UI.formatNumber(c.viewCount)}</td>
        <td class="small text-nowrap">${UI.formatDate(c.updatedAt)}</td>
        <td class="text-nowrap text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit">Sửa</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete"
                  data-title="${UI.escapeHtml(c.title)}">Xóa</button>
        </td>
      </tr>`;
    }

    const messageRow = html => `<tr><td colspan="8" class="text-center py-4">${html}</td></tr>`;

    async function loadList() {
        const id = ++reqId;
        tbody.innerHTML = messageRow('<div class="spinner-border text-warning"></div>');

        const q = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE, sort: 'newest' });
        if (state.keyword) q.set('keyword', state.keyword);

        try {
            const data = await Api.get('/api/Comics?' + q);
            if (id !== reqId) return;

            // Xóa hết truyện ở trang cuối thì lùi về trang trước
            if (data.items.length === 0 && data.totalItems > 0 && state.page > 1) {
                state.page = data.totalPages;
                return loadList();
            }

            totalText.textContent = `(${UI.formatNumber(data.totalItems)})`;
            tbody.innerHTML = data.items.length
                ? data.items.map(rowHtml).join('')
                : messageRow('<span class="text-muted">Không có truyện nào.</span>');

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                state.page = p;
                loadList();
            });
        } catch (err) {
            if (id !== reqId) return;
            tbody.innerHTML = messageRow(`<div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div>`);
        }
    }

    // ---------- Biểu mẫu thêm / sửa ----------
    function showFormError(text) {
        formAlert.textContent = text;
        formAlert.classList.remove('d-none');
    }

    function setPreview(src) {
        coverPreview.src = src || UI.placeholder;
    }

    function resetForm() {
        form.reset();
        formAlert.classList.add('d-none');
        coverUrl = null;
        pendingFile = null;
        setPreview(null);
        genreChecks.querySelectorAll('input').forEach(i => { i.checked = false; });
    }

    function openAdd() {
        editingId = null;
        resetForm();
        modalTitle.textContent = 'Thêm truyện';
        modal.show();
    }

    async function openEdit(id) {
        try {
            const c = await Api.get('/api/Comics/' + id);   // lấy đủ mô tả và thể loại
            editingId = c.id;
            resetForm();
            modalTitle.textContent = 'Sửa truyện';

            form.elements.title.value = c.title;
            form.elements.author.value = c.author || '';
            form.elements.status.value = c.status;
            form.elements.description.value = c.description || '';
            c.genres.forEach(g => { const cb = $('g_' + g.id); if (cb) cb.checked = true; });

            coverUrl = c.coverUrl;
            setPreview(c.coverUrl);
            modal.show();
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    }

    // Chọn ảnh bìa: kiểm tra sơ bộ và xem trước ngay (chưa tải lên server)
    coverFile.addEventListener('change', () => {
        const f = coverFile.files[0];
        if (!f) return;

        if (!f.type.startsWith('image/')) {
            showFormError('Vui lòng chọn file ảnh');
            coverFile.value = '';
            return;
        }
        if (f.size > 2 * 1024 * 1024) {
            showFormError('Ảnh bìa tối đa 2 MB');
            coverFile.value = '';
            return;
        }

        formAlert.classList.add('d-none');
        pendingFile = f;
        setPreview(URL.createObjectURL(f));
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        formAlert.classList.add('d-none');

        const title = form.elements.title.value.trim();
        if (!title) return showFormError('Vui lòng nhập tên truyện');

        saveBtn.disabled = true;
        const oldText = saveBtn.textContent;
        saveBtn.textContent = 'Đang lưu...';

        try {
            // Có ảnh bìa mới thì tải lên trước để lấy đường dẫn
            if (pendingFile) {
                coverUrl = await Admin.uploadCover(pendingFile);
                pendingFile = null;      // lỡ lưu truyện lỗi thì bấm lại cũng không phải tải ảnh lần nữa
            }

            const dto = {
                title,
                author: form.elements.author.value.trim() || null,
                description: form.elements.description.value.trim() || null,
                status: form.elements.status.value,
                coverUrl,
                genreIds: [...genreChecks.querySelectorAll('input:checked')].map(i => Number(i.value)),
            };

            if (editingId) {
                await Api.put(`/api/admin/comics/${editingId}`, dto);
                Admin.toast('Đã cập nhật truyện');
            } else {
                await Api.post('/api/admin/comics', dto);
                Admin.toast('Đã thêm truyện');
                state.page = 1;          // truyện mới nằm đầu danh sách
            }

            modal.hide();
            loadList();
        } catch (err) {
            showFormError(err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = oldText;
        }
    });

    // ---------- Xóa ----------
    async function removeComic(id, title) {
        const ok = confirm(`Xóa truyện "${title}"?\nToàn bộ chương, ảnh và bình luận của truyện sẽ bị xóa vĩnh viễn.`);
        if (!ok) return;

        try {
            await Api.del(`/api/admin/comics/${id}`);
            Admin.toast('Đã xóa truyện');
            loadList();
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    }

    // ---------- Sự kiện ----------
    tbody.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.closest('tr').dataset.id;

        if (btn.dataset.action === 'edit') openEdit(id);
        if (btn.dataset.action === 'delete') removeComic(id, btn.dataset.title);
    });

    searchForm.addEventListener('submit', e => {
        e.preventDefault();
        state.keyword = searchInput.value.trim();
        state.page = 1;
        loadList();
    });

    $('addBtn').addEventListener('click', openAdd);

    // ---------- Khởi động ----------
    (async function init() {
        loadList();
        try {
            const genres = await Api.get('/api/Genres');
            genreChecks.innerHTML = genres.map(g => `
        <input type="checkbox" class="btn-check" id="g_${g.id}" value="${g.id}" autocomplete="off">
        <label class="btn btn-outline-secondary btn-sm" for="g_${g.id}">${UI.escapeHtml(g.name)}</label>`
            ).join('');
        } catch {
            genreChecks.textContent = 'Không tải được danh sách thể loại';
        }
    })();
})();