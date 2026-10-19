// Tiện ích dùng chung cho các trang quản trị
const Admin = (() => {
    // Kiểm tra quyền. Trả về false nếu không được vào trang (và đã xử lý chuyển hướng/hiện thông báo).
    // Lưu ý: đây chỉ để người dùng đỡ vào nhầm, bảo vệ thật sự nằm ở server ([Authorize(Roles = "Admin")]).
    function guard() {
        if (!Auth.requireLogin()) return false;      // chưa đăng nhập -> sang trang login

        if (!Auth.isAdmin()) {
            const root = document.getElementById('adminRoot');
            if (root) {
                root.innerHTML = `
          <div class="text-center py-5">
            <h3 class="mb-2">Bạn không có quyền truy cập trang này</h3>
            <p class="text-muted">Trang này chỉ dành cho quản trị viên.</p>
            <a class="btn btn-warning" href="/index.html">Về trang chủ</a>
          </div>`;
            }
            return false;
        }
        return true;
    }

    // Thanh tab điều hướng giữa các trang quản trị
    function renderNav(active) {
        const host = document.getElementById('adminNav');
        if (!host) return;
        const tab = (key, label, href) =>
            `<li class="nav-item"><a class="nav-link ${active === key ? 'active' : ''}" href="${href}">${label}</a></li>`;
        host.innerHTML = `
      <ul class="nav nav-pills mb-4">
        ${tab('comics', 'Truyện', '/admin/comics.html')}
        ${tab('genres', 'Thể loại', '/admin/genres.html')}
        ${tab('users', 'Người dùng', '/admin/users.html')}
      </ul>`;
    }

    // Thông báo nhỏ góc dưới bên phải
    function toast(message, type = 'success') {
        let box = document.getElementById('toastBox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'toastBox';
            box.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(box);
        }

        const el = document.createElement('div');
        el.className = `toast align-items-center text-bg-${type} border-0`;
        el.setAttribute('role', 'alert');
        el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body"></div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
        el.querySelector('.toast-body').textContent = message;   // textContent để an toàn

        box.appendChild(el);
        el.addEventListener('hidden.bs.toast', () => el.remove());
        new bootstrap.Toast(el, { delay: 3500 }).show();
    }

    // Tải ảnh bìa lên, trả về đường dẫn (url)
    async function uploadCover(file) {
        const fd = new FormData();
        fd.append('File', file);                      // tên trường khớp với UploadCoverRequest.File
        const res = await Api.post('/api/Upload/cover', fd);
        return res.url;
    }

    // Tải nhiều ảnh trang lên, trả về mảng đường dẫn (đã sắp theo tên file)
    async function uploadChapterImages(files) {
        const fd = new FormData();
        for (const f of files) fd.append('Files', f); // khớp với UploadChapterImagesRequest.Files
        const res = await Api.post('/api/Upload/chapter-images', fd);
        return res.urls;
    }

    return { guard, renderNav, toast, uploadCover, uploadChapterImages };
})();