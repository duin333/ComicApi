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
        list.innerHTML = UI.spinner();
        try {
            const data = await Api.get(`/api/Follows?page=${page}&pageSize=${PAGE_SIZE}`);

            if (data.items.length === 0 && data.totalItems > 0 && page > 1) {
                page = data.totalPages;
                return load();
            }

            totalText.textContent = `(${UI.formatNumber(data.totalItems)})`;

            // Dữ liệu cùng kiểu với trang chủ nên dùng lại luôn thẻ truyện
            list.innerHTML = data.items.length
                ? data.items.map(UI.comicCard).join('')
                : `<div class="col-12 text-center py-5">
             <p class="text-muted">Bạn chưa theo dõi truyện nào.</p>
             <a class="btn btn-warning" href="index.html">Khám phá truyện</a>
           </div>`;

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