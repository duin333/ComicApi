(() => {
    if (!Admin.guard()) return;
    Admin.renderNav('comics');            // trang chương thuộc nhóm "Truyện"

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_IMAGES = 100;

    const $ = id => document.getElementById(id);
    const comicId = parseInt(new URLSearchParams(location.search).get('comicId'));

    const tbody = $('chapterRows');
    const totalText = $('totalText');
    const modalEl = $('chapterModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = $('chapterForm');
    const formAlert = $('formAlert');
    const saveBtn = $('saveBtn');
    const modalTitle = $('modalTitle');
    const imageFiles = $('imageFiles');
    const grid = $('imgGrid');
    const imgCount = $('imgCount');

    let chapters = [];       // danh sách chương đang hiển thị (để tính số chương kế tiếp)
    let editingId = null;    // null nghĩa là đang thêm mới
    // Mỗi ảnh: { url, file, preview }. Ảnh cũ có url; ảnh mới chọn có file và chờ tải lên khi bấm Lưu
    let items = [];

    function showNotFound() {
        $('pageContent').innerHTML = `
      <div class="text-center py-5">
        <h4 class="mb-3">Không tìm thấy truyện</h4>
        <a class="btn btn-warning" href="/admin/comics.html">Về danh sách truyện</a>
      </div>`;
    }

    if (!comicId) {
        showNotFound();
        return;
    }

    // ---------- Danh sách chương ----------
    const messageRow = html => `<tr><td colspan="7" class="text-center py-4">${html}</td></tr>`;

    function rowHtml(c) {
        return `
      <tr data-id="${c.id}" data-label="Chương ${c.number}">
        <td class="fw-semibold">${c.number}</td>
        <td>${UI.escapeHtml(c.title)}</td>
        <td>${c.imageCount}</td>
        <td class="text-end">${UI.formatNumber(c.viewCount)}</td>
        <td>
          <span class="badge ${c.isHidden ? 'text-bg-secondary' : 'text-bg-success'}">
            ${c.isHidden ? 'Đang ẩn' : 'Hiển thị'}
          </span>
        </td>
        <td class="small text-nowrap">${UI.formatDate(c.createdAt)}</td>
        <td class="text-nowrap text-end">
          ${c.isHidden ? '' : `<a class="btn btn-sm btn-outline-secondary" href="/reader.html?id=${c.id}" target="_blank">Xem</a>`}
          <button type="button" class="btn btn-sm btn-outline-dark" data-action="toggle">${c.isHidden ? 'Hiện' : 'Ẩn'}</button>
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit">Sửa</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">Xóa</button>
        </td>
      </tr>`;
    }

    async function loadList() {
        tbody.innerHTML = messageRow('<div class="spinner-border text-warning"></div>');
        try {
            // Bản dành cho admin: có cả chương đang ẩn. desc=true để chương mới nhất lên đầu
            chapters = await Api.get(`/api/admin/comics/${comicId}/chapters?desc=true`);
            totalText.textContent = `(${chapters.length})`;
            tbody.innerHTML = chapters.length
                ? chapters.map(rowHtml).join('')
                : messageRow('<span class="text-muted">Truyện này chưa có chương nào.</span>');
        } catch (err) {
            tbody.innerHTML = messageRow(`<div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div>`);
        }
    }

    // ---------- Lưới ảnh trong form ----------
    function renderImages() {
        imgCount.textContent = items.length;
        grid.innerHTML = items.map((it, i) => `
      <div class="img-item" data-i="${i}">
        <img src="${UI.escapeHtml(it.preview)}" alt="Trang ${i + 1}"
             onerror="this.onerror=null;this.src=UI.placeholder">
        <span class="badge text-bg-dark img-index">${i + 1}</span>
        ${it.file ? '<span class="badge text-bg-warning img-new">Mới</span>' : ''}
        <div class="img-tools">
          <button type="button" class="btn btn-sm btn-light py-0" data-act="left" ${i === 0 ? 'disabled' : ''}>←</button>
          <button type="button" class="btn btn-sm btn-light py-0 text-danger" data-act="remove">✕</button>
          <button type="button" class="btn btn-sm btn-light py-0" data-act="right" ${i === items.length - 1 ? 'disabled' : ''}>→</button>
        </div>
      </div>`).join('');
    }

    const isBlob = it => it.preview.startsWith('blob:');

    grid.addEventListener('click', e => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const i = Number(btn.closest('.img-item').dataset.i);

        if (btn.dataset.act === 'remove') {
            const [removed] = items.splice(i, 1);
            if (isBlob(removed)) URL.revokeObjectURL(removed.preview);   // giải phóng bộ nhớ ảnh xem trước
        } else {
            const j = btn.dataset.act === 'left' ? i - 1 : i + 1;
            [items[i], items[j]] = [items[j], items[i]];
        }
        renderImages();
    });

    // Chọn nhiều ảnh: kiểm tra sơ bộ, sắp theo tên file, thêm vào cuối danh sách
    imageFiles.addEventListener('change', () => {
        const files = [...imageFiles.files].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        const problems = [];
        for (const f of files) {
            if (!f.type.startsWith('image/')) { problems.push(`${f.name}: không phải ảnh`); continue; }
            if (f.size > MAX_IMAGE_BYTES) { problems.push(`${f.name}: vượt quá 5 MB`); continue; }
            if (items.length >= MAX_IMAGES) { problems.push(`Tối đa ${MAX_IMAGES} ảnh mỗi chương`); break; }
            items.push({ url: null, file: f, preview: URL.createObjectURL(f) });
        }

        imageFiles.value = '';      // để lần sau chọn lại cùng file vẫn nhận
        renderImages();

        if (problems.length) showFormError(problems.join('; '));
        else formAlert.classList.add('d-none');
    });

    // ---------- Biểu mẫu ----------
    function showFormError(text) {
        formAlert.textContent = text;
        formAlert.classList.remove('d-none');
    }

    function resetForm() {
        form.reset();
        formAlert.classList.add('d-none');
        items = [];
        renderImages();
    }

    function openAdd() {
        editingId = null;
        resetForm();
        modalTitle.textContent = 'Thêm chương';
        form.elements.number.value = Math.max(0, ...chapters.map(c => c.number)) + 1;   // gợi ý số kế tiếp
        modal.show();
    }

    async function openEdit(id) {
        try {
            const c = await Api.get(`/api/admin/chapters/${id}`);
            editingId = c.id;
            resetForm();
            modalTitle.textContent = `Sửa chương ${c.number}`;

            form.elements.number.value = c.number;
            form.elements.title.value = c.title;
            form.elements.isHidden.checked = c.isHidden;
            items = c.images.map(im => ({ url: im.imageUrl, file: null, preview: im.imageUrl }));
            renderImages();
            modal.show();
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    }

    // Đóng hộp thoại thì dọn ảnh xem trước
    modalEl.addEventListener('hidden.bs.modal', () => {
        items.filter(isBlob).forEach(it => URL.revokeObjectURL(it.preview));
        items = [];
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        formAlert.classList.add('d-none');

        const number = parseInt(form.elements.number.value);
        if (!Number.isInteger(number) || number < 1) return showFormError('Số chương phải là số nguyên từ 1 trở lên');
        if (items.length === 0) return showFormError('Chương cần ít nhất 1 ảnh');

        saveBtn.disabled = true;
        const oldText = saveBtn.textContent;

        try {
            // Tải lần lượt từng ảnh mới lên server, giữ đúng thứ tự bạn đã sắp
            const pending = items.filter(it => it.file);
            let done = 0;
            for (const it of items) {
                if (!it.file) continue;
                saveBtn.textContent = `Đang tải ảnh ${++done}/${pending.length}...`;
                const urls = await Admin.uploadChapterImages([it.file]);
                it.url = urls[0];
                it.file = null;     // đã tải xong; nếu bước sau lỗi, bấm Lưu lại sẽ không phải tải lại
            }

            saveBtn.textContent = 'Đang lưu...';
            const dto = {
                number,
                title: form.elements.title.value.trim() || `Chương ${number}`,
                isHidden: form.elements.isHidden.checked,
                imageUrls: items.map(it => it.url),
            };

            if (editingId) {
                await Api.put(`/api/admin/chapters/${editingId}`, dto);
                Admin.toast('Đã cập nhật chương');
            } else {
                await Api.post(`/api/admin/comics/${comicId}/chapters`, dto);
                Admin.toast('Đã thêm chương');
            }

            modal.hide();
            loadList();
        } catch (err) {
            showFormError(err.message);       // ví dụ: "Chương số 3 đã tồn tại"
            renderImages();                   // cập nhật nhãn "Mới" của những ảnh đã tải xong
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = oldText;
        }
    });

    // ---------- Ẩn/hiện, sửa, xóa ----------
    tbody.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const tr = btn.closest('tr');
        const id = tr.dataset.id;

        try {
            if (btn.dataset.action === 'edit') {
                openEdit(id);
            } else if (btn.dataset.action === 'toggle') {
                const res = await Api.patch(`/api/admin/chapters/${id}/toggle-hidden`);
                Admin.toast(res.isHidden ? 'Đã ẩn chương' : 'Đã hiện chương');
                loadList();
            } else if (btn.dataset.action === 'delete') {
                if (!confirm(`Xóa ${tr.dataset.label}?\nToàn bộ ảnh của chương sẽ bị xóa vĩnh viễn.`)) return;
                await Api.del(`/api/admin/chapters/${id}`);
                Admin.toast('Đã xóa chương');
                loadList();
            }
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    });

    $('addBtn').addEventListener('click', openAdd);

    // ---------- Khởi động ----------
    (async function init() {
        try {
            const comic = await Api.get('/api/Comics/' + comicId);
            $('comicTitle').textContent = comic.title;
            document.title = `Chương - ${comic.title} - ComicHub`;
        } catch (err) {
            if (err.status === 404) { showNotFound(); return; }
        }
        loadList();
    })();
})();