(() => {
    // Chỉ chấp nhận chuyển hướng về trang trong cùng website
    function getRedirect() {
        const r = new URLSearchParams(location.search).get('redirect');
        const safe = r && r.startsWith('/') && !r.startsWith('//') && !/(login|register)\.html/.test(r);
        return safe ? r : 'index.html';
    }

    // Đã đăng nhập rồi thì không cần vào trang này
    if (Auth.isLoggedIn()) {
        location.replace(getRedirect());
        return;
    }

    const form = document.getElementById('loginForm');
    const alertBox = document.getElementById('alertBox');
    const submitBtn = document.getElementById('submitBtn');

    // 11.1: bị đưa về đây vì lý do gì thì báo đúng lý do đó
    const REASONS = {
        account_locked: 'Tài khoản của bạn đã bị khóa nên đã bị đăng xuất. Hãy liên hệ quản trị viên nếu cần hỗ trợ.',
        account_missing: 'Tài khoản này không còn tồn tại.',
        role_changed: 'Quyền của tài khoản đã thay đổi, vui lòng đăng nhập lại.',
        expired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
        invalid_token: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
    };
    const reason = new URLSearchParams(location.search).get('reason');
    if (reason && REASONS[reason]) {
        alertBox.className = 'alert alert-warning';
        alertBox.textContent = REASONS[reason];
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        alertBox.className = 'alert alert-danger d-none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập...';

        try {
            const res = await Api.post('/api/Auth/login', {
                usernameOrEmail: form.elements.usernameOrEmail.value.trim(),
                password: form.elements.password.value,
            });
            Auth.save(res);
            location.href = getRedirect();
        } catch (err) {
            alertBox.textContent = err.message;
            alertBox.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng nhập';
        }
    });
})();