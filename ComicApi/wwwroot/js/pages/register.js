(() => {
    if (Auth.isLoggedIn()) {
        location.replace('index.html');
        return;
    }

    const form = document.getElementById('registerForm');
    const alertBox = document.getElementById('alertBox');
    const submitBtn = document.getElementById('submitBtn');

    function showError(text) {
        alertBox.textContent = text;
        alertBox.classList.remove('d-none');
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        alertBox.classList.add('d-none');

        const username = form.elements.username.value.trim();
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const confirm = form.elements.confirm.value;

        // Kiểm tra sơ bộ ở trình duyệt (server vẫn kiểm tra lại, đây chỉ để báo lỗi nhanh)
        if (username.length < 3 || username.length > 50) return showError('Tên đăng nhập phải từ 3 đến 50 ký tự');
        if (!/^\S+@\S+\.\S+$/.test(email)) return showError('Email không hợp lệ');
        if (password.length < 6) return showError('Mật khẩu tối thiểu 6 ký tự');
        if (password !== confirm) return showError('Mật khẩu nhập lại không khớp');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng ký...';

        try {
            const res = await Api.post('/api/Auth/register', { username, email, password });
            Auth.save(res);                  // đăng ký xong tự đăng nhập luôn
            location.href = 'index.html';
        } catch (err) {
            showError(err.message);          // ví dụ: "Tên đăng nhập đã tồn tại"
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng ký';
        }
    });
})();