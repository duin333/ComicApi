(() => {
    if (!Admin.guard()) return;
    Admin.renderNav('genres');

    const $ = id => document.getElementById(id);
    const rows = $('genreRows');
    const totalText = $('totalText');
    const modalEl = $('genreModal');
    const modal = new bootstrap.Modal(modalEl);
    const form = $('genreForm');
    const nameInput = $('genreName');
    const formAlert = $('formAlert');
    const saveBtn = $('saveBtn');
    const modalTitle = $('modalTitle');

    let editingId = null;   // null nghĩa là đang thêm mới

    const messageRow = html => `<tr><td colspan="3" class="text-center py-4">${html}</td></tr>`;

    async function load() {
        rows.innerHTML = messageRow('<div class="spinner-border text-warning"></div>');
        try {
            const list = await Api.get('/api/Genres');
            totalText.textContent = `(${list.length})`;
            rows.innerHTML = list.length
                ? list.map((g, i) => `
            <tr data-id="${g.id}" data-name="${UI.escapeHtml(g.name)}">
              <td>${i + 1}</td>
              <td class="fw-semibold">${UI.escapeHtml(g.name)}</td>
              <td class="text-nowrap text-end">
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit">Sửa</button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">Xóa</button>
              </td>
            </tr>`).join('')
                : messageRow('<span class="text-muted">Chưa có thể loại nào.</span>');
        } catch (err) {
            rows.innerHTML = messageRow(`<div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div>`);
        }
    }

    function showError(text) {
        formAlert.textContent = text;
        formAlert.classList.remove('d-none');
    }

    function openForm(id, name) {
        editingId = id;
        formAlert.classList.add('d-none');
        nameInput.value = name;
        modalTitle.textContent = id ? 'Sửa thể loại' : 'Thêm thể loại';
        modal.show();
    }

    modalEl.addEventListener('shown.bs.modal', () => nameInput.focus());

    form.addEventListener('submit', async e => {
        e.preventDefault();
        formAlert.classList.add('d-none');

        const name = nameInput.value.trim();
        if (!name) return showError('Vui lòng nhập tên thể loại');

        saveBtn.disabled = true;
        try {
            if (editingId) {
                await Api.put(`/api/admin/genres/${editingId}`, { name });
                Admin.toast('Đã cập nhật thể loại');
            } else {
                await Api.post('/api/admin/genres', { name });
                Admin.toast('Đã thêm thể loại');
            }
            modal.hide();
            load();
        } catch (err) {
            showError(err.message);        // ví dụ: "Thể loại đã tồn tại"
        } finally {
            saveBtn.disabled = false;
        }
    });

    rows.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const tr = btn.closest('tr');

        if (btn.dataset.action === 'edit') {
            openForm(tr.dataset.id, tr.dataset.name);
            return;
        }

        if (!confirm(`Xóa thể loại "${tr.dataset.name}"?`)) return;
        try {
            await Api.del(`/api/admin/genres/${tr.dataset.id}`);
            Admin.toast('Đã xóa thể loại');
            load();
        } catch (err) {
            Admin.toast(err.message, 'danger');   // ví dụ: đang được dùng bởi N truyện
        }
    });

    $('addBtn').addEventListener('click', () => openForm(null, ''));

    load();
})();