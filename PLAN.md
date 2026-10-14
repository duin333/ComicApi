# PLAN.md – Web đọc truyện tranh tích hợp chatbot AI

> File này là nguồn sự thật duy nhất cho cả người làm và AI (Claude Code / Codex). Đọc file này trước khi viết code. Muốn đổi kế hoạch thì sửa file này trước.

## 1. Mục tiêu

Đồ án môn Lập trình web nâng cao: web đọc truyện tranh theo mô hình **REST API + client** (không MVC, không WebForm), có **chatbot AI** gợi ý và tóm tắt truyện. Làm một mình, khoảng 1 tháng, chạy trên Visual Studio.

**Chấm điểm:** REST API + client = 9 điểm, thêm chatbot AI = 10 điểm.

## 2. Công nghệ

| Phần | Công nghệ |
|---|---|
| Backend | ASP.NET Core Web API (C#), bản .NET đang cài trong Visual Studio |
| Database | MySQL + MySQL Workbench |
| ORM | Entity Framework Core + `Pomelo.EntityFrameworkCore.MySql` (chọn bản khớp với bản EF Core/.NET đang dùng) |
| Xác thực | JWT (`Microsoft.AspNetCore.Authentication.JwtBearer`), băm mật khẩu bằng `BCrypt.Net-Next` |
| Tài liệu API | Swagger (có sẵn trong template) |
| Client | HTML + CSS + JavaScript thuần, gọi API bằng `fetch`, đặt trong `wwwroot` (chạy 1 lần F5) |
| Chatbot | Gemini API (gói free, Google AI Studio), gọi từ backend |
| Quản lý mã | Git, commit sau mỗi tính năng chạy được |

**Không dùng:** MVC/Razor View, WebForm, microservice, CQRS, vector database.

## 3. Cấu trúc thư mục

```
ComicApi/
├── Controllers/            1 file / tài nguyên: AuthController, ComicsController, ChaptersController,
│                           GenresController, FollowsController, HistoryController, CommentsController,
│                           AdminUsersController, UploadController, ChatController
├── Services/               chỉ cho phần ngoài truy vấn dữ liệu: JwtService (tạo token), PasswordHasher
│   └── Chat/               LlmClient (chỉ gọi Gemini), PromptBuilder (dựng prompt), ChatService (điều phối)
├── Repositories/           IRepository<T>, Repository<T> (generic) + repository riêng khi cần truy vấn
│                           phức tạp: ComicRepository (hot, latest, search), ChapterRepository, ...
├── Data/
│   ├── AppDbContext.cs
│   ├── Configurations/     1 file cấu hình / entity (IEntityTypeConfiguration<T>)
│   └── DbSeeder.cs         dữ liệu mẫu
├── Models/                 entity: User, Comic, Genre, ComicGenre, Chapter, ChapterImage,
│                           Follow, ReadingHistory, Comment
├── DTOs/                   gom theo thư mục: Auth/, Comics/, Chapters/, Chat/, Common/
├── Extensions/             ServiceExtensions.cs, AuthExtensions.cs, SwaggerExtensions.cs
├── Migrations/             tự sinh, KHÔNG sửa tay
├── wwwroot/                CLIENT
│   ├── index.html, comic.html, reader.html, login.html, register.html,
│   │   following.html, history.html
│   ├── admin/              index.html, comics.html, chapters.html, users.html
│   ├── css/                base.css, layout.css, components/, pages/
│   ├── js/
│   │   ├── api/            client.js (hàm fetch chung), comics.js, auth.js, chat.js, ...
│   │   ├── pages/          home.js, comic.js, reader.js, admin-*.js, ...
│   │   ├── components/     navbar.js, comicCard.js, chatWidget.js
│   │   └── utils/          auth.js (lưu/đọc token), format.js
│   ├── images/             ảnh giao diện
│   └── uploads/            ảnh bìa + ảnh chương (không commit lên Git)
├── appsettings.json        không chứa bí mật
└── Program.cs              chỉ vài dòng gọi lại các extension
```

## 4. Quy tắc code (dặn cả AI)

1. **Một file làm một việc.** File quá khoảng 250 dòng thì tách.
2. **Thêm tính năng = thêm file mới**, hạn chế nhét vào file cũ.
3. **Kiến trúc theo slide của thầy: Controller → Repository → DbContext → Database.** Controller mỏng, chỉ nhận request, gọi Repository, trả kết quả. Truy vấn DB nằm ở Repository. Chỉ phần JWT, băm mật khẩu và chatbot tách thành Service riêng.
4. **Controller không trả Entity trực tiếp**, luôn dùng DTO.
5. **Mã HTTP đúng:** 200, 201, 400 (dữ liệu sai), 401 (chưa đăng nhập), 403 (không đủ quyền), 404 (không thấy).
6. **Phân quyền ở API** bằng `[Authorize]` / `[Authorize(Roles = "Admin")]`, không chỉ ẩn nút ở giao diện.
7. **Bí mật (JWT key, Gemini API key, connection string mật khẩu) để trong User Secrets**, không commit.
8. **Client:** mọi lệnh gọi API đi qua `js/api/`, mỗi trang một file trong `js/pages/`, đoạn giao diện dùng lại thì làm thành component trong `js/components/`.
9. **Đặt tên theo chức năng**, nhìn tên file là biết nó làm gì.
10. **Không thêm tính năng ngoài file này** nếu chưa được đồng ý.

## 5. Database (MySQL)

Tất cả khóa ngoại dùng `ON DELETE CASCADE` (trừ `comics.uploader_id` dùng `SET NULL`). Thời gian lưu UTC.

| Bảng | Cột chính |
|---|---|
| `users` | id, username, email (unique), password_hash, avatar_url (null), role (`Admin` / `User` / `Uploader`), is_locked, created_at |
| `comics` | id, title, slug (unique), author, description, cover_url, status (`Ongoing` / `Completed`), views, uploader_id (null), created_at, updated_at |
| `genres` | id, name (unique), slug |
| `comic_genres` | comic_id, genre_id (khóa chính kép) |
| `chapters` | id, comic_id, chapter_number (decimal), title, status (`Draft` / `Published`), created_at. Unique (comic_id, chapter_number) |
| `chapter_images` | id, chapter_id, image_url, page_number. Unique (chapter_id, page_number) |
| `follows` | id, user_id, comic_id, created_at. Unique (user_id, comic_id) |
| `reading_history` | id, user_id, comic_id, chapter_id, last_read_at. Unique (user_id, comic_id) |
| `comments` | id, user_id, comic_id, chapter_id (null), content, created_at |

Ghi chú:
- `views` lưu thẳng ở `comics` để lấy truyện hot nhanh.
- `role` làm enum/chuỗi từ đầu, dù chưa dùng `Uploader`, để sau này thêm không phải đổi cấu trúc.
- Index: `comics.slug`, `comics.title`, `chapters.comic_id`.
- `comments.chapter_id` để trống nghĩa là bình luận ở cấp truyện; có giá trị nghĩa là bình luận ở cấp chương.
- Tham khảo từ sơ đồ ERD của đồ án TruyenZ (Hình 3.14) nhưng bỏ `users.online_time`, `comics.last_crawled_at` (không crawl truyện) và chưa dùng `comics.rating`, `chapters.views`.
- Nếu làm thêm đánh giá sao: thêm bảng `ratings` (user_id, comic_id, score, unique cặp user + comic) và cột `comics.rating`. Nếu muốn thống kê lượt xem theo chương: thêm `chapters.views`.

## 6. Danh sách API

Tiền tố `/api`. 🔓 = ai cũng gọi được, 🔑 = cần đăng nhập, 🛡️ = chỉ Admin.

**Auth**
- 🔓 `POST /auth/register` – đăng ký
- 🔓 `POST /auth/login` – trả JWT
- 🔑 `GET /auth/me` – thông tin người đang đăng nhập

**Truyện**
- 🔓 `GET /comics?search=&genreId=&status=&sort=&page=&pageSize=` – danh sách, tìm kiếm, lọc, phân trang
- 🔓 `GET /comics/hot` – nhiều view nhất
- 🔓 `GET /comics/latest` – mới cập nhật
- 🔓 `GET /comics/{id}` – chi tiết (tăng views mỗi lần gọi)
- 🛡️ `POST /comics`, `PUT /comics/{id}`, `DELETE /comics/{id}`

**Chương**
- 🔓 `GET /comics/{comicId}/chapters` – danh sách chương (chỉ Published)
- 🔓 `GET /chapters/{id}` – chi tiết chương + danh sách ảnh theo `page_number` + id chương trước/sau
- 🛡️ `POST /comics/{comicId}/chapters`, `PUT /chapters/{id}`, `DELETE /chapters/{id}`

**Thể loại**
- 🔓 `GET /genres`
- 🛡️ `POST /genres`, `PUT /genres/{id}`, `DELETE /genres/{id}`

**Upload**
- 🛡️ `POST /upload/cover` – trả `cover_url`
- 🛡️ `POST /upload/chapter-images` – nhiều ảnh, trả danh sách URL theo thứ tự

**Theo dõi / lịch sử / bình luận**
- 🔑 `GET /follows`, `POST /follows/{comicId}`, `DELETE /follows/{comicId}`
- 🔑 `GET /history`, `PUT /history` (body: comicId, chapterId)
- 🔓 `GET /comics/{id}/comments`
- 🔑 `POST /comments`, `DELETE /comments/{id}` (chủ bình luận hoặc Admin)

**Quản lý user**
- 🛡️ `GET /admin/users`, `PUT /admin/users/{id}/role`, `PUT /admin/users/{id}/lock`, `DELETE /admin/users/{id}`
- Admin không được tự khóa hoặc tự bỏ quyền của chính mình.

**Chatbot**
- 🔓 `POST /chat` – body: `{ "message": "..." }`

## 7. Chatbot AI

### Luồng xử lý (`ChatService`)
1. Chuẩn hóa tin nhắn (chữ thường, cắt khoảng trắng, giới hạn 300 ký tự).
2. **Nhận diện ý định bằng từ khóa** (`switch`):
   - có "hot", "nhiều view", "phổ biến" → lấy top truyện nhiều view từ MySQL
   - có "mới", "vừa ra", "cập nhật" → lấy truyện mới cập nhật từ MySQL
   - còn lại → gợi ý/tóm tắt/hỏi đáp qua LLM
3. **Dựng ngữ cảnh (`PromptBuilder`):**
   - Danh mục gọn: mỗi truyện gồm id, tên, thể loại, trạng thái, mô tả ngắn (tối đa ~200 ký tự).
   - Nếu tin nhắn nhắc đến tên một truyện có trong DB, thêm mô tả đầy đủ và danh sách chương của truyện đó (phục vụ tóm tắt).
4. **System prompt:** vai trò "trợ lý tư vấn truyện của website"; chỉ trả lời dựa trên dữ liệu được cung cấp; truyện không có trong dữ liệu thì nói "website chưa có truyện này"; không tiết lộ cái kết hay tình tiết nút thắt; trả lời ngắn, thân thiện, tiếng Việt; **chỉ trả JSON** dạng `{"reply": "...", "comicIds": [1, 5]}`.
5. **Gọi Gemini (`LlmClient`)**, đọc kết quả JSON.
6. **Kiểm tra `comicIds` với DB** (bỏ id không tồn tại, tránh AI bịa), rồi trả:
   ```json
   { "reply": "...", "suggestedComics": [ { "id": 1, "title": "...", "coverUrl": "..." } ] }
   ```
7. **Xử lý lỗi:** gặp 429 (hết lượt free), timeout hoặc JSON hỏng thì trả câu "Chatbot đang bận, bạn thử lại sau nhé" với mã 200, không để web sập.

### Chi tiết kỹ thuật
- Tên model Gemini để trong `appsettings.json` (dễ đổi); API key để trong User Secrets. Đọc tài liệu Gemini API hiện hành trước khi code vì tên model và hạn mức free có thể thay đổi.
- Giới hạn số tin nhắn mỗi người mỗi phút (vài lượt) để không cạn hạn mức free.
- `LlmClient` đứng sau interface `ILlmClient` để sau này đổi nhà cung cấp chỉ sửa một file.
- **Client:** `chatWidget.js` là nút chat nổi ở góc dưới phải trên mọi trang; tin nhắn trả về có thẻ truyện bấm được dẫn tới `comic.html?id=...`.

### Nâng cấp nếu dư thời gian
Embedding + so cosine trong code, nhớ lịch sử hội thoại, gợi ý theo lịch sử đọc của người dùng.

## 8. Tính năng

**Phải có (bản chấm):**
- Khách: trang chủ (hot, mới), chi tiết truyện, đọc truyện, tìm theo tên, lọc thể loại, đăng ký, đăng nhập, chatbot
- Người đọc: theo dõi, lịch sử đọc tự lưu, bình luận
- Admin: CRUD truyện, CRUD chương (nhiều ảnh, ẩn/hiện), CRUD thể loại, quản lý user (đổi role, khóa)

**Làm thêm nếu dư thời gian:** dashboard thống kê, role Uploader (đăng và sửa truyện của chính mình), đánh giá sao, quản lý bình luận, đăng nhập Google, dark mode.

**Không làm:** crawl truyện tự động, upload ZIP, trang Nam/Nữ, microservice, CQRS, vector database.

## 9. Lộ trình 4 tuần

Mỗi ngày khoảng 2-3 giờ; tuần 4 khoảng 4-5 giờ. Chừa khoảng 20% thời gian dự phòng.

### Tuần 1 – Nền tảng và API đọc dữ liệu
- [x] Xác nhận với thầy (mục 11): đã xong
- [ ] Tạo project `ComicApi`, repo Git, `.gitignore` (loại `wwwroot/uploads`, secrets)
- [ ] Cài MySQL, tạo database, cấu hình connection string
- [ ] Models + cấu hình entity + migration đầu tiên; `DbSeeder` với vài truyện mẫu
- [ ] `IRepository` / `Repository`, đăng ký DI qua `ServiceExtensions`
- [ ] Auth: register, login (JWT), `/auth/me`
- [ ] `GET /comics`, `/comics/{id}`, `/comics/hot`, `/comics/latest`, `/genres`
- [ ] **Xong khi:** thử hết các endpoint bằng Swagger, đăng nhập lấy token, bấm Authorize được

### Tuần 2 – Admin và giao diện đọc truyện
- [ ] Upload ảnh bìa và ảnh chương; CRUD truyện, chương, thể loại (có phân quyền Admin)
- [ ] Client: `login.html`, `register.html`, `index.html`, `comic.html`, `reader.html`
- [ ] Client: `js/api/client.js` (tự gắn token), navbar dùng chung
- [ ] Trang admin: quản lý truyện, quản lý chương
- [ ] **Xong khi:** admin đăng được một truyện có chương nhiều ảnh, người đọc mở ra đọc được từ trang chủ

### Tuần 3 – Tương tác người dùng và chatbot
- [ ] Theo dõi, lịch sử đọc (tự lưu khi mở chương), bình luận
- [ ] Quản lý user (admin)
- [ ] `ChatController`, `ChatService`, `PromptBuilder`, `LlmClient`
- [ ] Widget chat trên client, thẻ truyện bấm được
- [ ] **Xong khi:** chatbot gợi ý và tóm tắt được ít nhất 5 câu hỏi mẫu; hỏi ngoài dữ liệu thì báo "chưa có"

### Tuần 4 – Hoàn thiện và chuẩn bị chấm
- [ ] Test toàn bộ luồng theo từng actor, sửa lỗi
- [ ] Kiểm tra phân quyền (gọi thử API admin bằng tài khoản thường phải bị 403)
- [ ] Dữ liệu mẫu đủ đẹp để demo; xuất file `.sql` có dữ liệu
- [ ] README: cách cài MySQL, chạy migration, cấu hình secrets, chạy project
- [ ] Báo cáo + sơ đồ (use case, ERD, luồng chatbot) + kịch bản demo
- [ ] Ôn vấn đáp (mục 10)

## 10. Quy trình làm việc với AI

- **Một công cụ sửa code tại một thời điểm.** Codex quản lý kế hoạch, Claude Code viết hoặc sửa; không để hai bên sửa cùng lúc.
- Mỗi lần giao việc, dán đúng mục liên quan trong file này (ví dụ mục 5 khi làm DB) kèm yêu cầu cụ thể.
- **Làm từng tính năng nhỏ**: viết, chạy, thử, rồi `git commit`. Đừng nhờ AI làm cả tuần trong một lần.
- **Sau mỗi tính năng, nhờ AI giải thích luồng chạy** (request đi qua những file nào) và tự nói lại bằng lời của mình. Thầy hay hỏi vấn đáp.
- Cần hiểu để trả lời được: REST là gì, JWT hoạt động ra sao, vì sao có DTO, Repository và Service để làm gì, DI là gì, chatbot lấy dữ liệu ở đâu để không bịa.
- Gặp lỗi: dán nguyên thông báo lỗi và đoạn code liên quan cho AI, đừng chỉ nói "bị lỗi".

## 11. Việc cần xác nhận và rủi ro

**Xác nhận với thầy** (slide của thầy đã nêu kiến trúc Controller → Repository và client tách frontend/backend, phần còn lại cần chắc):
1. ✅ Đã rõ: client HTML/JS (fetch gọi API) đặt chung project trong `wwwroot` là được. (Khi báo cáo vẫn nêu rõ: client không có Controller/View, chỉ gọi API.)
2. ✅ Đã rõ: chấm trên máy của mình. Vẫn nên xuất file `.sql` và viết README để dự phòng.

**Rủi ro:**
- Upload nhiều ảnh và lưu đúng thứ tự trang là phần dễ lỗi nhất, nên làm sớm (tuần 2).
- Hết hạn mức free của Gemini khi demo: đã có xử lý lỗi, nhưng hãy thử chatbot trước buổi chấm và tránh gọi dồn dập.
- Dữ liệu truyện: dùng truyện tự tạo hoặc public domain, không lấy truyện có bản quyền về demo.
- Phình tính năng: chỉ làm mục "Làm thêm" sau khi mục "Phải có" chạy ổn.