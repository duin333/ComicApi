# Báo cáo kiểm tra phân quyền ComicHub

- Thời điểm chạy: 2026-11-06 11:30:15
- Máy chủ được thử: https://localhost:7046
- Kết quả: **206/206 đạt** ✅

Ký hiệu trong bảng: `✓ 401` = đạt, nhận đúng mã 401. `✗ 200 (cần 401)` = LỖI phân quyền. `—` = không áp dụng hoặc không thử.

## A. Điểm cuối công khai (ai cũng gọi được)

| Điểm cuối | Khách | Reader | Admin |
|---|---|---|---|
| `GET /api/Comics` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Comics/hot` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Comics/latest` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Comics/featured` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Comics/{id}` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Comics/{id}/chapters` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Genres` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/Chapters/{id}` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/comics/{id}/comments` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /api/comics/{id}/ratings` | ✓ 200 | ✓ 200 | ✓ 200 |
| `GET /health` | ✓ 200 | ✓ 200 | ✓ 200 |
| `POST /api/Chapters/{id}/view` | ✓ 204 | ✓ 204 | ✓ 204 |
| `POST /api/Chat` | ✓ 400 | ✓ 400 | ✓ 400 |

## B. Điểm cuối cần đăng nhập

| Điểm cuối | Khách | Reader | Admin |
|---|---|---|---|
| `GET /api/Auth/me` | ✓ 401 | ✓ 200 | ✓ 200 |
| `GET /api/Follows` | ✓ 401 | ✓ 200 | ✓ 200 |
| `GET /api/History` | ✓ 401 | ✓ 200 | ✓ 200 |
| `GET /api/Follows/{id}/status` | ✓ 401 | ✓ 200 | ✓ 200 |
| `GET /api/History/comics/{id}` | ✓ 401 | ✓ 204 | ✓ 204 |
| `POST /api/Follows/{id}` | ✓ 401 | ✓ 200 | — |
| `DELETE /api/Follows/{id}` | ✓ 401 | ✓ 200 | — |
| `POST /api/History/chapters/{id}` | ✓ 401 | ✓ 204 | — |
| `DELETE /api/History/comics/{id}` | ✓ 401 | ✓ 204 | — |
| `DELETE /api/History` | ✓ 401 | ✓ 204 | — |
| `PUT /api/comics/{id}/ratings/mine` | ✓ 401 | ✓ 200 | — |
| `DELETE /api/comics/{id}/ratings/mine` | ✓ 401 | ✓ 200 | — |
| `POST /api/comics/{id}/comments` | ✓ 401 | ✓ 201 | — |
| `PUT /api/comments/{id}/like` | ✓ 401 | ✓ 200 | — |
| `DELETE /api/comments/{id}/like` | ✓ 401 | ✓ 200 | — |

## C. Điểm cuối chỉ Admin

| Điểm cuối | Khách | Reader | Admin |
|---|---|---|---|
| `POST /api/admin/comics` | ✓ 401 | ✓ 403 | ✓ 201 |
| `PUT /api/admin/comics/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `DELETE /api/admin/comics/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `GET /api/admin/comics/{id}/chapters` | ✓ 401 | ✓ 403 | ✓ 200 |
| `GET /api/admin/chapters/{id}` | ✓ 401 | ✓ 403 | ✓ 200 |
| `POST /api/admin/comics/{id}/chapters` | ✓ 401 | ✓ 403 | ✓ 201 |
| `PUT /api/admin/chapters/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `PATCH /api/admin/chapters/{id}/toggle-hidden` | ✓ 401 | ✓ 403 | ✓ 200 |
| `DELETE /api/admin/chapters/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `POST /api/admin/genres` | ✓ 401 | ✓ 403 | ✓ 201 |
| `PUT /api/admin/genres/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `DELETE /api/admin/genres/{id}` | ✓ 401 | ✓ 403 | ✓ 204 |
| `GET /api/admin/users` | ✓ 401 | ✓ 403 | ✓ 200 |
| `PUT /api/admin/users/{id}/role` | ✓ 401 | ✓ 403 | ✓ 204 |
| `PUT /api/admin/users/{id}/lock` | ✓ 401 | ✓ 403 | ✓ 204 |
| `GET /api/admin/comments` | ✓ 401 | ✓ 403 | ✓ 200 |
| `GET /api/admin/comments/stats` | ✓ 401 | ✓ 403 | ✓ 200 |
| `POST /api/admin/comments/bulk-delete` | ✓ 401 | ✓ 403 | ✓ 200 |
| `DELETE /api/admin/comments/by-user/{id}` | ✓ 401 | ✓ 403 | ✓ 200 |
| `POST /api/Upload/cover` | ✓ 401 | ✓ 403 | ✓ 400 |
| `POST /api/Upload/chapter-images` | ✓ 401 | ✓ 403 | ✓ 200 |
| `GET /api/Chat/test/models` | ✓ 401 | ✓ 403 | — |

## D. Quyền theo chủ sở hữu (không thể xóa bài của người khác)

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Khách xóa bình luận của Reader | 401 | 401 | ✓ đạt |
| Reader2 xóa bình luận của Reader | 403 | 403 | ✓ đạt |
| Reader2 trả lời bình luận của Reader | 2xx | 201 | ✓ đạt |
| Phản hồi nằm đúng chủ đề (GET replies) | có id 4231 | có | ✓ đạt |
| Trả lời bình luận thuộc truyện KHÁC bị từ chối | 400 | 400 | ✓ đạt |
| Thích bình luận không tồn tại | 404 | 404 | ✓ đạt |
| Reader tự xóa bình luận của mình | 2xx | 204 | ✓ đạt |
| Admin xóa phản hồi của Reader2 | 2xx | 204 | ✓ đạt |

## E. Token giả mạo và sai định dạng đều bị từ chối (401)

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Reader sửa token thành Admin, giữ chữ ký cũ → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Reader sửa token thành Admin, giữ chữ ký cũ → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Reader sửa token thành Admin, alg=none → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Reader sửa token thành Admin, alg=none → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Reader sửa token thành Admin, ký bằng khóa khác → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Reader sửa token thành Admin, ký bằng khóa khác → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Admin giả: kéo dài hạn token, giữ chữ ký cũ → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Admin giả: kéo dài hạn token, giữ chữ ký cũ → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Admin giả: đúng người đúng vai trò, alg=none → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Admin giả: đúng người đúng vai trò, alg=none → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Admin giả: đúng người đúng vai trò, ký bằng khóa khác → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Admin giả: đúng người đúng vai trò, ký bằng khóa khác → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Chuỗi rác 'abc.def.ghi' → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Chuỗi rác 'abc.def.ghi' → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Chuỗi rác không có dấu chấm → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Chuỗi rác không có dấu chấm → GET /api/admin/users | 401 | 401 | ✓ đạt |
| Sai kiểu xác thực (Basic) → GET /api/Auth/me | 401 | 401 | ✓ đạt |
| Sai kiểu xác thực (Basic) → GET /api/admin/users | 401 | 401 | ✓ đạt |

## F. Khóa tài khoản và đổi quyền có hiệu lực ngay (11.1)

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Đang bị khóa: token cũ gọi /api/Auth/me | 401 | 401 | ✓ đạt |
| Đang bị khóa: nội dung báo mã account_locked | account_locked | có | ✓ đạt |
| Đang bị khóa: token cũ gọi /api/Follows | 401 | 401 | ✓ đạt |
| Đang bị khóa: đăng nhập lại | 403 | 403 | ✓ đạt |
| Tài khoản bị khóa sẵn (docgia99) đăng nhập | 403 | 403 | ✓ đạt |
| Mở khóa: token cũ dùng lại được | 200 | 200 | ✓ đạt |
| Vừa đổi quyền: token cũ bị từ chối | 401 | 401 | ✓ đạt |
| Vừa đổi quyền: nội dung báo mã role_changed | role_changed | có | ✓ đạt |
| Sau khi lên Admin và đăng nhập lại: vào được /api/admin/users | 200 | 200 | ✓ đạt |
| Bị hạ về Reader: token Admin cũ lập tức vô hiệu | 401 | 401 | ✓ đạt |
| Đăng nhập lại sau khi bị hạ quyền: không vào được /api/admin/users | 403 | 403 | ✓ đạt |

## F2. Quy tắc tự bảo vệ của Admin (thử bằng tài khoản docgia30 đang tạm làm Admin)

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Admin tự khóa chính mình | 400 | 400 | ✓ đạt |
| Admin tự đổi quyền của chính mình | 400 | 400 | ✓ đạt |
| Đổi quyền sang giá trị lạ 'Superuser' | 400 | 400 | ✓ đạt |
| Khóa người dùng không tồn tại | 404 | 404 | ✓ đạt |

## G. Chương bị ẩn không lộ ra cho người đọc

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Admin vẫn xem được chương ẩn (isHidden = true) | 200 + isHidden | 200 | ✓ đạt |
| Khách mở chương ẩn GET /api/Chapters/{id} | 404 | 404 | ✓ đạt |
| Khách tăng lượt xem chương ẩn | 404 | 404 | ✓ đạt |
| Khách: danh sách chương của truyện KHÔNG chứa chương ẩn | không có id 152 | không lộ | ✓ đạt |
| Reader mở chương ẩn GET /api/Chapters/{id} | 404 | 404 | ✓ đạt |
| Reader tăng lượt xem chương ẩn | 404 | 404 | ✓ đạt |
| Reader: danh sách chương của truyện KHÔNG chứa chương ẩn | không có id 152 | không lộ | ✓ đạt |
| Chương vừa được hiện: Khách mở được | 200 | 200 | ✓ đạt |
| Ẩn lại: Khách lại không mở được | 404 | 404 | ✓ đạt |

## H. Không tự nâng quyền khi đăng ký

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Đăng ký có kèm role=Admin trong nội dung gửi lên | 2xx | 200 | ✓ đạt |
| Tài khoản mới chỉ là Reader, không phải Admin | Reader | Reader | ✓ đạt |
| Tài khoản mới vào /api/admin/users | 403 | 403 | ✓ đạt |

## I. Header, CORS và tệp không được lộ

| Phép thử | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| Trang web lạ gọi API: không có Access-Control-Allow-Origin | không có header | không có | ✓ đạt |
| Preflight từ trang lạ: không được cho phép | không có header | không có | ✓ đạt |
| API có X-Content-Type-Options: nosniff | nosniff | nosniff | ✓ đạt |
| API có Cache-Control no-store | no-store | no-store | ✓ đạt |
| Không lộ header Server | không có | không có | ✓ đạt |
| GET /appsettings.json (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
| GET /appsettings.Development.json (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
| GET /ComicApi.csproj (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
| GET /Program.cs (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
| GET /logs/ (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
| GET /uploads/ (tệp cấu hình/mã nguồn/thư mục) | 404 | 404 | ✓ đạt |
