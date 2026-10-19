// Quản lý trạng thái đăng nhập (lưu trong localStorage của trình duyệt)
const Auth = (() => {
    const TOKEN_KEY = 'comic_token';
    const USER_KEY = 'comic_user';
    const EXP_KEY = 'comic_token_exp';

    // Lưu kết quả trả về từ /api/Auth/login hoặc /register
    function save(authResponse) {
        localStorage.setItem(TOKEN_KEY, authResponse.token);
        localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
        localStorage.setItem(EXP_KEY, authResponse.expiresAt);
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(EXP_KEY);
    }

    // Trả về token, hoặc null nếu chưa đăng nhập / token đã hết hạn
    function getToken() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        const exp = localStorage.getItem(EXP_KEY);
        if (exp && new Date(exp) < new Date()) {
            logout();
            return null;
        }
        return token;
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY));
        } catch {
            return null;
        }
    }

    const isLoggedIn = () => !!getToken();

    function isAdmin() {
        const user = getUser();
        return isLoggedIn() && user?.role === 'Admin';
    }

    // Dùng ở các trang bắt buộc đăng nhập: chưa đăng nhập thì chuyển sang trang login
    function requireLogin() {
        if (isLoggedIn()) return true;
        location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
        return false;
    }

    return { save, logout, getToken, getUser, isLoggedIn, isAdmin, requireLogin };
})();