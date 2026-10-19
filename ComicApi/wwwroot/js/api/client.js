class ApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

const Api = (() => {
    // Lấy câu thông báo lỗi dễ hiểu từ phản hồi của server
    function extractMessage(data, status) {
        if (data && typeof data === 'object') {
            if (data.message) return data.message;
            if (data.errors) return Object.values(data.errors).flat().join(' ');
            if (data.title) return data.title;
        }
        if (status === 401) return 'Bạn cần đăng nhập';
        if (status === 403) return 'Bạn không có quyền thực hiện thao tác này';
        if (status === 404) return 'Không tìm thấy dữ liệu';
        return 'Có lỗi xảy ra, vui lòng thử lại';
    }

    async function request(method, url, body) {
        const headers = {};
        const token = Auth.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;   // tự gắn token

        let payload;
        if (body instanceof FormData) {
            payload = body;                      // upload file: để trình duyệt tự đặt Content-Type
        } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url, { method, headers, body: payload });
        } catch {
            throw new ApiError(0, 'Không kết nối được máy chủ');
        }

        if (res.status === 204) return null;

        const text = await res.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = text; }
        }

        if (!res.ok) {
            // Token hết hạn hoặc bị từ chối: xóa và đưa về trang đăng nhập
            if (res.status === 401 && token && !url.startsWith('/api/Auth/login')) {
                Auth.logout();
                location.href = '/login.html?redirect=' +
                    encodeURIComponent(location.pathname + location.search);
            }
            throw new ApiError(res.status, extractMessage(data, res.status), data);
        }
        return data;
    }

    return {
        get: url => request('GET', url),
        post: (url, body) => request('POST', url, body),
        put: (url, body) => request('PUT', url, body),
        patch: (url, body) => request('PATCH', url, body),
        del: url => request('DELETE', url),
    };
})();