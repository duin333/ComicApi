(() => {
    if (!Admin.guard()) return;
    Admin.renderNav('users');

    const PAGE_SIZE = 15;
    const $ = id => document.getElementById(id);
    const tbody = $('userRows');
    const pager = $('pager');
    const totalText = $('totalText');

    const me = Auth.getUser();                 // để biết dòng nào là chính mình
    const state = { keyword: '', page: 1 };
    let reqId = 0;

    const messageRow = html => `<tr><td colspan="7" class="text-center py-4">${html}</td></tr>`;

    function rowHtml(u) {
        const isMe = !!me && u.id === me.id;
        const admin = u.role === 'Admin';
        // Server không cho tự khóa mình hay tự đổi quyền mình, nên ở đây khóa nút luôn cho khỏi bấm nhầm
        const disabled = isMe ? 'disabled title="Bạn không thể thao tác với chính mình"' : '';

        return `
      <tr data-id="${u.id}" data-name="${UI.escapeHtml(u.username)}"
          data-role="${u.role}" data-locked="${u.isLocked}">
        <td>${u.id}</td>
        <td class="fw-semibold">
          ${UI.escapeHtml(u.username)}
          ${isMe ? '<span class="badge text-bg-light border ms-1">Bạn</span>' : ''}
        </td>
        <td>${UI.escapeHtml(u.email)}</td>
        <td><span class="badge ${admin ? 'text-bg-warning' : 'text-bg-secondary'}">${admin ? 'Admin' : 'Reader'}</span></td>
        <td><span class="badge ${u.isLocked ? 'text-bg-danger' : 'text-bg-success'}">${u.isLocked ? 'Đã khóa' : 'Hoạt động'}</span></td>
        <td class="small text-nowrap">${UI.formatDate(u.createdAt)}</td>
        <td class="text-nowrap text-end">
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="role" ${disabled}>
            ${admin ? 'Gỡ quyền Admin' : 'Cấp quyền Admin'}
          </button>
          <button type="button" class="btn btn-sm ${u.isLocked ? 'btn-outline-success' : 'btn-outline-danger'}"
                  data-action="lock" ${disabled}>
            ${u.isLocked ? 'Mở khóa' : 'Khóa'}
          </button>
        </td>
      </tr>`;
    }

    async function load() {
        const id = ++reqId;
        tbody.innerHTML = messageRow('<div class="spinner-border text-warning"></div>');

        const q = new URLSearchParams({ page: state.page, pageSize: PAGE_SIZE });
        if (state.keyword) q.set('keyword', state.keyword);

        try {
            const data = await Api.get('/api/admin/users?' + q);
            if (id !== reqId) return;

            totalText.textContent = `(${UI.formatNumber(data.totalItems)})`;
            tbody.innerHTML = data.items.length
                ? data.items.map(rowHtml).join('')
                : messageRow('<span class="text-muted">Không tìm thấy người dùng nào.</span>');

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                state.page = p;
                load();
            });
        } catch (err) {
            if (id !== reqId) return;
            tbody.innerHTML = messageRow(`<div class="alert alert-danger mb-0">${UI.escapeHtml(err.message)}</div>`);
        }
    }

    tbody.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn || btn.disabled) return;

        const tr = btn.closest('tr');
        const id = tr.dataset.id;
        const name = tr.dataset.name;

        try {
            if (btn.dataset.action === 'role') {
                const makeAdmin = tr.dataset.role !== 'Admin';
                const ok = confirm(makeAdmin
                    ? `Cấp quyền Admin cho "${name}"?`
                    : `Gỡ quyền Admin của "${name}"?`);
                if (!ok) return;

                await Api.put(`/api/admin/users/${id}/role`, { role: makeAdmin ? 'Admin' : 'Reader' });
                Admin.toast('Đã cập nhật vai trò');
            } else {
                const lock = tr.dataset.locked !== 'true';
                const ok = confirm(lock
                    ? `Khóa tài khoản "${name}"? Người này sẽ không đăng nhập lại được.`
                    : `Mở khóa tài khoản "${name}"?`);
                if (!ok) return;

                await Api.put(`/api/admin/users/${id}/lock`, { isLocked: lock });
                Admin.toast(lock ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
            }
            load();
        } catch (err) {
            Admin.toast(err.message, 'danger');
        }
    });

    $('searchForm').addEventListener('submit', e => {
        e.preventDefault();
        state.keyword = $('searchInput').value.trim();
        state.page = 1;
        load();
    });

    load();
})();