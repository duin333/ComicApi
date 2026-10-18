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

    form.addEventListener('submit', async e => {
        e.preventDefault();
        alertBox.classList.add('d-none');
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