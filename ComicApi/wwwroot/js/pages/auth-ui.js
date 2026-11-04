// 11.2: khi server báo "quá nhiều lần" (429), khóa nút gửi và đếm ngược cho đỡ bấm dồn
const AuthUi = {
    // Server chỉ cho biết thời gian chờ TỐI ĐA nên nút chỉ khóa tối đa 30 giây rồi mở lại;
    // nếu vẫn còn bị giới hạn, server sẽ báo lại và nút lại đếm ngược
    cooldown(btn, seconds, idleText) {
        let left = Math.max(1, Math.min(30, Math.ceil(seconds)));
        btn.disabled = true;

        const tick = () => {
            if (left <= 0) {
                clearInterval(timer);
                btn.disabled = false;
                btn.textContent = idleText;
                return;
            }
            btn.textContent = `Thử lại sau ${left} giây`;
            left--;
        };

        const timer = setInterval(tick, 1000);
        tick();
    },
};
(() => {
    // Nút "Hiện/Ẩn" mật khẩu
    document.querySelectorAll('.pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;

            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.textContent = show ? 'Ẩn' : 'Hiện';
            btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    });

    // Thanh đo độ mạnh mật khẩu (chỉ ở trang đăng ký)
    const pw = document.getElementById('password');
    const bar = document.getElementById('pwBar');
    const label = document.getElementById('pwLabel');
    if (!pw || !bar || !label) return;

    pw.addEventListener('input', () => {
        const v = pw.value;

        if (!v) {
            bar.style.width = '0';
            label.textContent = '';
            return;
        }
        if (v.length < 6) {
            bar.style.width = '15%';
            bar.style.background = '#dc3545';
            label.textContent = 'Quá ngắn (tối thiểu 6 ký tự)';
            return;
        }

        let score = 1;
        if (v.length >= 10) score++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;

        const levels = {
            1: ['35%', '#fd7e14', 'Yếu'],
            2: ['55%', '#fd7e14', 'Tạm được'],
            3: ['75%', '#0d9488', 'Khá'],
            4: ['90%', '#0f766e', 'Mạnh'],
            5: ['100%', '#0f766e', 'Rất mạnh'],
        };
        const [width, color, text] = levels[score];
        bar.style.width = width;
        bar.style.background = color;
        label.textContent = 'Độ mạnh: ' + text;
    });
})();