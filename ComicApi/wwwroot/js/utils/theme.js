// Đặt chế độ sáng/tối ngay khi trang bắt đầu tải, để không bị nháy màu trắng rồi mới chuyển tối
(function () {
    var theme = 'light';
    try { theme = localStorage.getItem('comichub_theme') === 'dark' ? 'dark' : 'light'; } catch (e) { }
    document.documentElement.setAttribute('data-bs-theme', theme);
})();