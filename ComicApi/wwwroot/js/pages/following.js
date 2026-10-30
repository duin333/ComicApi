(() => {
    // Trang này cần đăng nhập, chưa đăng nhập thì chuyển sang trang login rồi quay lại
    if (!Auth.requireLogin()) return;

    const PAGE_SIZE = 12;
    const $ = id => document.getElementById(id);
    const list = $('comicList');
    const pager = $('pager');
    const totalText = $('totalText');

    let page = 1;

    async function load() {
        list.innerHTML = UI.skeletonCards(6);
        try {
            // Lấy thêm danh sách truyện hot để gắn đúng ruy-băng HOT như ở trang chủ
            const [data, hot] = await Promise.all([
                Api.get(`/api/Follows?page=${page}&pageSize=${PAGE_SIZE}`),
                Api.get('/api/Comics/hot?take=6').catch(() => []),
            ]);

            // Xóa hết truyện ở trang cuối thì lùi về trang trước
            if (data.items.length === 0 && data.totalItems > 0 && page > 1) {
                page = data.totalPages;
                return load();
            }

            totalText.textContent = data.totalItems ? `(${UI.formatNumber(data.totalItems)})` : '';

            const ctx = { hotIds: new Set(hot.map(c => c.id)) };
            list.innerHTML = data.items.length
                ? data.items.map(c => UI.comicCardX(c, ctx)).join('')
                : UI.emptyState({
                    kind: 'follow',
                    title: 'Bạn chưa theo dõi truyện nào',
                    text: 'Bấm nút “Theo dõi” ở trang truyện để lưu truyện yêu thích vào đây và không bỏ lỡ chương mới.',
                    href: '/index.html?browse=1',
                    label: 'Khám phá truyện',
                });

            UI.renderPagination(pager, data.page, data.totalPages, p => {
                page = p;
                load();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch (err) {
            list.innerHTML = UI.message(err.message);
            pager.innerHTML = '';
        }
    }

    load();
})();