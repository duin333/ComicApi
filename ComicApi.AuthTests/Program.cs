// Bộ kiểm tra phân quyền ComicHub (Giai đoạn 11.5).
// Chạy API trước (Ctrl+F5), rồi: dotnet run --project ComicApi.AuthTests -- --url https://localhost:7046
//
// Bài test dùng các tài khoản mẫu trong script seed: admin, reader1, docgia01, docgia30.
// Dữ liệu thử (truyện, chương, thể loại) được tạo rồi xóa đi; docgia30 tạm thời bị khóa/đổi quyền rồi khôi phục.
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ComicApi.AuthTests;

Console.OutputEncoding = Encoding.UTF8;

var opt = Options.Parse(args);
var api = new Api(opt.Url, opt.SkipCert);
var rec = new Recorder();

const int NoSuchId = 2_000_000_000;      // id không tồn tại: gọi thử các lệnh phá hủy mà không sợ xóa nhầm dữ liệu thật
const string GA = "A. Điểm cuối công khai (ai cũng gọi được)";
const string GB = "B. Điểm cuối cần đăng nhập";
const string GC = "C. Điểm cuối chỉ Admin";
const string GF2 = "F2. Quy tắc tự bảo vệ của Admin (thử bằng tài khoản docgia30 đang tạm làm Admin)";

var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
var fake = Encoding.UTF8.GetBytes("day khong phai anh <script>alert(1)</script>");

var guest = new Actor("Khách");
var admin = new Actor("Admin", "admin", opt.AdminPass);
var reader = new Actor("Reader", "reader1", opt.ReaderPass);
var reader2 = new Actor("Reader2", "docgia01", opt.ReaderPass);
var victim = new Actor("Victim", "docgia30", opt.ReaderPass);

int comicId = 0, comic2Id = 0, chapterVisible = 0, chapterHidden = 0, genreId = 0;

Console.WriteLine($"Kiểm tra phân quyền tại {opt.Url}");

// ---------------------------------------------------------------------------------------------
async Task<Resp> Login(Actor a)
{
    var r = await api.Send(null, "POST", "/api/Auth/login", new { usernameOrEmail = a.Username, password = a.Password });
    if (r.Status == 200)
    {
        a.Token = r.Json?["token"]?.ToString();
        a.Id = r.Json?["user"]?["id"]?.GetValue<int>() ?? 0;
    }
    return r;
}

void Abort(string msg)
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine("\nDỪNG: " + msg);
    Console.ResetColor();
    Environment.Exit(2);
}

async Task Denied(string label, string method, string path, object? body = null)
{
    rec.Add(label, "Khách", (await api.Send(guest, method, path, body)).Status, "401");
    rec.Add(label, "Reader", (await api.Send(reader, method, path, body)).Status, "403");
}

async Task DeniedFile(string label, string path, string field)
{
    rec.Add(label, "Khách", (await api.SendFile(guest, path, field, "t.png", png, "image/png")).Status, "401");
    rec.Add(label, "Reader", (await api.SendFile(reader, path, field, "t.png", png, "image/png")).Status, "403");
}

async Task<int> NewComic(string title)
{
    var r = await api.Send(admin, "POST", "/api/admin/comics", new { title, description = "Dữ liệu thử phân quyền, sẽ bị xóa", author = "AuthTest", status = "Ongoing", genreIds = Array.Empty<int>() });
    return r.Status is >= 200 and < 300 ? r.Json?["id"]?.GetValue<int>() ?? 0 : 0;
}

async Task<string?> UploadPng()
{
    var r = await api.SendFile(admin, "/api/Upload/chapter-images", "Files", "1.png", png, "image/png");
    return r.Json?["urls"]?[0]?.ToString();
}

Resp rComicCreate, rUpload, rChapterCreate, rHiddenCreate;
try
{
    // ===== 0. Đăng nhập và chuẩn bị dữ liệu thử =====
    rec.Group("0. Chuẩn bị");
    foreach (var a in new[] { admin, reader, reader2, victim })
    {
        var r = await Login(a);
        if (r.Status == 429) Abort("Đăng nhập bị giới hạn tốc độ (429). Chờ vài phút, hoặc tạm nâng RateLimits:Login:PermitLimit lên 50 trong appsettings.Development.json khi chạy test.");
        if (r.Status != 200 || a.Token is null) Abort($"Không đăng nhập được '{a.Username}' (HTTP {r.Status}). Đã chạy script seed dữ liệu chưa? Mật khẩu mặc định: admin/Admin@123, các tài khoản khác/Reader@123 (dùng --admin-pass, --reader-pass để đổi).");
        rec.Info($"Đã đăng nhập {a.Username} (Id {a.Id})");
    }

    rComicCreate = await api.Send(admin, "POST", "/api/admin/comics", new { title = "[AUTHTEST] Truyện thử phân quyền", description = "Dữ liệu thử, sẽ bị xóa", author = "AuthTest", status = "Ongoing", genreIds = Array.Empty<int>() });
    comicId = rComicCreate.Status is >= 200 and < 300 ? rComicCreate.Json?["id"]?.GetValue<int>() ?? 0 : 0;
    if (comicId == 0) Abort($"Admin không tạo được truyện thử (HTTP {rComicCreate.Status}): {rComicCreate.Body}");
    comic2Id = await NewComic("[AUTHTEST] Truyện thử số 2");

    var url1 = await UploadPng(); var url2 = await UploadPng();
    rUpload = await api.SendFile(admin, "/api/Upload/chapter-images", "Files", "1.png", png, "image/png");
    if (url1 is null || url2 is null) Abort("Admin không tải được ảnh thử lên (/api/Upload/chapter-images).");

    rChapterCreate = await api.Send(admin, "POST", $"/api/admin/comics/{comicId}/chapters", new { number = 1, title = "Chương thử (hiện)", isHidden = false, imageUrls = new[] { url1 } });
    chapterVisible = rChapterCreate.Json?["id"]?.GetValue<int>() ?? 0;
    rHiddenCreate = await api.Send(admin, "POST", $"/api/admin/comics/{comicId}/chapters", new { number = 2, title = "Chương thử (ẩn)", isHidden = true, imageUrls = new[] { url2 } });
    chapterHidden = rHiddenCreate.Json?["id"]?.GetValue<int>() ?? 0;
    if (chapterVisible == 0 || chapterHidden == 0) Abort($"Không tạo được chương thử: {rChapterCreate.Status} / {rHiddenCreate.Status}");
    rec.Info($"Dữ liệu thử: truyện {comicId} (+{comic2Id}), chương hiện {chapterVisible}, chương ẩn {chapterHidden}");

    // ===== A. Công khai =====
    rec.Group(GA);
    var publicGets = new (string label, string path)[]
    {
        ("GET /api/Comics", "/api/Comics?pageSize=1"),
        ("GET /api/Comics/hot", "/api/Comics/hot"),
        ("GET /api/Comics/latest", "/api/Comics/latest"),
        ("GET /api/Comics/featured", "/api/Comics/featured"),
        ("GET /api/Comics/{id}", $"/api/Comics/{comicId}"),
        ("GET /api/Comics/{id}/chapters", $"/api/Comics/{comicId}/chapters"),
        ("GET /api/Genres", "/api/Genres"),
        ("GET /api/Chapters/{id}", $"/api/Chapters/{chapterVisible}"),
        ("GET /api/comics/{id}/comments", $"/api/comics/{comicId}/comments"),
        ("GET /api/comics/{id}/ratings", $"/api/comics/{comicId}/ratings"),
        ("GET /health", "/health"),
    };
    foreach (var (label, path) in publicGets)
        foreach (var (who, col) in new[] { (guest, "Khách"), (reader, "Reader"), (admin, "Admin") })
            rec.Add(label, col, (await api.Send(who, "GET", path)).Status, "200");

    foreach (var (who, col) in new[] { (guest, "Khách"), (reader, "Reader"), (admin, "Admin") })
    {
        rec.Add("POST /api/Chapters/{id}/view", col, (await api.Send(who, "POST", $"/api/Chapters/{chapterVisible}/view")).Status, "2xx");
        // Chatbot ai cũng dùng được: gửi tin nhắn rỗng phải bị từ chối vì dữ liệu sai (400) chứ KHÔNG phải vì chưa đăng nhập (401/403)
        rec.Add("POST /api/Chat", col, (await api.Send(who, "POST", "/api/Chat", new { message = "" })).Status, "400");
    }

    // ===== B. Cần đăng nhập =====
    rec.Group(GB);
    foreach (var (label, path) in new[] { ("GET /api/Auth/me", "/api/Auth/me"), ("GET /api/Follows", "/api/Follows"), ("GET /api/History", "/api/History"),
        ("GET /api/Follows/{id}/status", $"/api/Follows/{comicId}/status"), ("GET /api/History/comics/{id}", $"/api/History/comics/{comicId}") })
    {
        rec.Add(label, "Khách", (await api.Send(guest, "GET", path)).Status, "401");
        rec.Add(label, "Reader", (await api.Send(reader, "GET", path)).Status, "2xx");
        rec.Add(label, "Admin", (await api.Send(admin, "GET", path)).Status, "2xx");
    }

    async Task Flow(string label, string method, string path, Actor who, object? body = null)
    {
        rec.Add(label, "Khách", (await api.Send(guest, method, path, body)).Status, "401");
        rec.Add(label, "Reader", (await api.Send(who, method, path, body)).Status, "2xx");
    }
    await Flow("POST /api/Follows/{id}", "POST", $"/api/Follows/{comicId}", reader);
    await Flow("DELETE /api/Follows/{id}", "DELETE", $"/api/Follows/{comicId}", reader);
    await Flow("POST /api/History/chapters/{id}", "POST", $"/api/History/chapters/{chapterVisible}", reader);
    await Flow("DELETE /api/History/comics/{id}", "DELETE", $"/api/History/comics/{comicId}", reader);
    await Flow("DELETE /api/History", "DELETE", "/api/History", victim);     // xóa lịch sử của tài khoản thử docgia30
    await Flow("PUT /api/comics/{id}/ratings/mine", "PUT", $"/api/comics/{comicId}/ratings/mine", reader, new { stars = 5 });
    await Flow("DELETE /api/comics/{id}/ratings/mine", "DELETE", $"/api/comics/{comicId}/ratings/mine", reader);

    var cm = await api.Send(reader, "POST", $"/api/comics/{comicId}/comments", new { content = "Bình luận thử phân quyền" });
    rec.Add("POST /api/comics/{id}/comments", "Khách", (await api.Send(guest, "POST", $"/api/comics/{comicId}/comments", new { content = "x" })).Status, "401");
    rec.Add("POST /api/comics/{id}/comments", "Reader", cm.Status, "2xx");
    var commentR = cm.Json?["id"]?.GetValue<int>() ?? 0;

    await Flow("PUT /api/comments/{id}/like", "PUT", $"/api/comments/{commentR}/like", reader2);
    await Flow("DELETE /api/comments/{id}/like", "DELETE", $"/api/comments/{commentR}/like", reader2);

    // ===== C. Chỉ Admin =====
    rec.Group(GC);
    object comicBody = new { title = "AuthTest không được tạo", status = "Ongoing", genreIds = Array.Empty<int>() };
    object chapterBody = new { number = 1, title = "x", isHidden = false, imageUrls = new[] { "/uploads/chapters/x.png" } };

    await Denied("POST /api/admin/comics", "POST", "/api/admin/comics", comicBody);
    rec.Add("POST /api/admin/comics", "Admin", rComicCreate.Status, "2xx");
    await Denied("PUT /api/admin/comics/{id}", "PUT", $"/api/admin/comics/{NoSuchId}", comicBody);
    rec.Add("PUT /api/admin/comics/{id}", "Admin", (await api.Send(admin, "PUT", $"/api/admin/comics/{comicId}", new { title = "[AUTHTEST] Truyện thử (đã sửa)", status = "Ongoing", genreIds = Array.Empty<int>() })).Status, "2xx");
    await Denied("DELETE /api/admin/comics/{id}", "DELETE", $"/api/admin/comics/{NoSuchId}");

    await Denied("GET /api/admin/comics/{id}/chapters", "GET", $"/api/admin/comics/{NoSuchId}/chapters");
    rec.Add("GET /api/admin/comics/{id}/chapters", "Admin", (await api.Send(admin, "GET", $"/api/admin/comics/{comicId}/chapters")).Status, "200");
    await Denied("GET /api/admin/chapters/{id}", "GET", $"/api/admin/chapters/{NoSuchId}");
    rec.Add("GET /api/admin/chapters/{id}", "Admin", (await api.Send(admin, "GET", $"/api/admin/chapters/{chapterHidden}")).Status, "200");
    await Denied("POST /api/admin/comics/{id}/chapters", "POST", $"/api/admin/comics/{NoSuchId}/chapters", chapterBody);
    rec.Add("POST /api/admin/comics/{id}/chapters", "Admin", rChapterCreate.Status, "2xx");
    await Denied("PUT /api/admin/chapters/{id}", "PUT", $"/api/admin/chapters/{NoSuchId}", chapterBody);
    rec.Add("PUT /api/admin/chapters/{id}", "Admin", (await api.Send(admin, "PUT", $"/api/admin/chapters/{chapterVisible}", new { number = 1, title = "Chương thử (đã sửa)", isHidden = false })).Status, "2xx");
    await Denied("PATCH /api/admin/chapters/{id}/toggle-hidden", "PATCH", $"/api/admin/chapters/{NoSuchId}/toggle-hidden");
    rec.Add("PATCH /api/admin/chapters/{id}/toggle-hidden", "Admin", (await api.Send(admin, "PATCH", $"/api/admin/chapters/{chapterHidden}/toggle-hidden")).Status, "2xx");
    rec.Add("PATCH /api/admin/chapters/{id}/toggle-hidden", "Admin", (await api.Send(admin, "PATCH", $"/api/admin/chapters/{chapterHidden}/toggle-hidden")).Status, "2xx");   // trả về trạng thái ẩn
    await Denied("DELETE /api/admin/chapters/{id}", "DELETE", $"/api/admin/chapters/{NoSuchId}");

    await Denied("POST /api/admin/genres", "POST", "/api/admin/genres", new { name = "AuthTest không được tạo" });
    var rg = await api.Send(admin, "POST", "/api/admin/genres", new { name = "[AUTHTEST] Thể loại thử" });
    rec.Add("POST /api/admin/genres", "Admin", rg.Status, "2xx");
    genreId = rg.Json?["id"]?.GetValue<int>() ?? 0;
    await Denied("PUT /api/admin/genres/{id}", "PUT", $"/api/admin/genres/{NoSuchId}", new { name = "x" });
    rec.Add("PUT /api/admin/genres/{id}", "Admin", (await api.Send(admin, "PUT", $"/api/admin/genres/{genreId}", new { name = "[AUTHTEST] Thể loại thử (sửa)" })).Status, "2xx");
    await Denied("DELETE /api/admin/genres/{id}", "DELETE", $"/api/admin/genres/{NoSuchId}");
    rec.Add("DELETE /api/admin/genres/{id}", "Admin", (await api.Send(admin, "DELETE", $"/api/admin/genres/{genreId}")).Status, "2xx");

    await Denied("GET /api/admin/users", "GET", "/api/admin/users");
    rec.Add("GET /api/admin/users", "Admin", (await api.Send(admin, "GET", "/api/admin/users")).Status, "200");
    await Denied("PUT /api/admin/users/{id}/role", "PUT", $"/api/admin/users/{NoSuchId}/role", new { role = "Reader" });
    await Denied("PUT /api/admin/users/{id}/lock", "PUT", $"/api/admin/users/{NoSuchId}/lock", new { isLocked = true });

    await Denied("GET /api/admin/comments", "GET", "/api/admin/comments");
    rec.Add("GET /api/admin/comments", "Admin", (await api.Send(admin, "GET", "/api/admin/comments")).Status, "200");
    await Denied("GET /api/admin/comments/stats", "GET", "/api/admin/comments/stats");
    rec.Add("GET /api/admin/comments/stats", "Admin", (await api.Send(admin, "GET", "/api/admin/comments/stats")).Status, "200");
    await Denied("POST /api/admin/comments/bulk-delete", "POST", "/api/admin/comments/bulk-delete", new { ids = new[] { NoSuchId } });
    rec.Add("POST /api/admin/comments/bulk-delete", "Admin", (await api.Send(admin, "POST", "/api/admin/comments/bulk-delete", new { ids = new[] { NoSuchId } })).Status, "!401/403");
    await Denied("DELETE /api/admin/comments/by-user/{id}", "DELETE", $"/api/admin/comments/by-user/{NoSuchId}");
    rec.Add("DELETE /api/admin/comments/by-user/{id}", "Admin", (await api.Send(admin, "DELETE", $"/api/admin/comments/by-user/{NoSuchId}")).Status, "!401/403");

    await DeniedFile("POST /api/Upload/cover", "/api/Upload/cover", "File");
    rec.Add("POST /api/Upload/cover", "Admin", (await api.SendFile(admin, "/api/Upload/cover", "File", "evil.png", fake, "image/png")).Status, "400", "Admin được phép, nhưng file giả bị từ chối");
    await DeniedFile("POST /api/Upload/chapter-images", "/api/Upload/chapter-images", "Files");
    rec.Add("POST /api/Upload/chapter-images", "Admin", rUpload.Status, "200");
    await Denied("GET /api/Chat/test/models", "GET", "/api/Chat/test/models");

    // ===== D. Chủ sở hữu bình luận =====
    rec.Group("D. Quyền theo chủ sở hữu (không thể xóa bài của người khác)");
    rec.Add("Khách xóa bình luận của Reader", "—", (await api.Send(guest, "DELETE", $"/api/comments/{commentR}")).Status, "401");
    rec.Add("Reader2 xóa bình luận của Reader", "—", (await api.Send(reader2, "DELETE", $"/api/comments/{commentR}")).Status, "403");

    var rep = await api.Send(reader2, "POST", $"/api/comics/{comicId}/comments", new { content = "Trả lời thử", parentId = commentR });
    rec.Add("Reader2 trả lời bình luận của Reader", "—", rep.Status, "2xx");
    var replyId = rep.Json?["id"]?.GetValue<int>() ?? 0;
    var replies = await api.Send(guest, "GET", $"/api/comments/{commentR}/replies");
    rec.AddBool("Phản hồi nằm đúng chủ đề (GET replies)", replies.BodyHasId(replyId), "có id " + replyId, replies.BodyHasId(replyId) ? "có" : "không có");

    var c2 = await NewCommentOn(comic2Id);
    var cross = await api.Send(reader2, "POST", $"/api/comics/{comicId}/comments", new { content = "Trả lời chéo truyện", parentId = c2 });
    rec.Add("Trả lời bình luận thuộc truyện KHÁC bị từ chối", "—", cross.Status, "400");
    rec.Add("Thích bình luận không tồn tại", "—", (await api.Send(reader, "PUT", $"/api/comments/{NoSuchId}/like")).Status, "404");

    var own = await api.Send(reader, "POST", $"/api/comics/{comicId}/comments", new { content = "Bình luận để tự xóa" });
    var ownId = own.Json?["id"]?.GetValue<int>() ?? 0;
    rec.Add("Reader tự xóa bình luận của mình", "—", (await api.Send(reader, "DELETE", $"/api/comments/{ownId}")).Status, "2xx");
    rec.Add("Admin xóa phản hồi của Reader2", "—", (await api.Send(admin, "DELETE", $"/api/comments/{replyId}")).Status, "2xx");

    async Task<int> NewCommentOn(int cid)
    {
        var r = await api.Send(reader, "POST", $"/api/comics/{cid}/comments", new { content = "Bình luận ở truyện số 2" });
        return r.Json?["id"]?.GetValue<int>() ?? 0;
    }

    // ===== E. Token giả =====
    rec.Group("E. Token giả mạo và sai định dạng đều bị từ chối (401)");

    static JsonObject PayloadOf(string token) =>
        JsonNode.Parse(Encoding.UTF8.GetString(B64Decode(token.Split('.')[1])))!.AsObject();

    static string Hmac(string header, string payloadB64, string key)
    {
        var data = header + "." + payloadB64;
        return data + "." + B64Encode(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(data)));
    }

    var hs256 = B64Encode(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"));
    var algNone = B64Encode(Encoding.UTF8.GetBytes("{\"alg\":\"none\",\"typ\":\"JWT\"}"));
    const string WrongKey = "khoa-bi-mat-gia-0123456789abcdef-khong-dung";

    var forged = new List<(string name, string header)>();

    // (1) Reader mạo danh Admin: sửa vai trò trong token. Chữ ký sai, và 11.1 cũng thấy vai trò lệch với database
    var esc = PayloadOf(reader.Token!);
    foreach (var key in esc.Select(p => p.Key).Where(k => k.EndsWith("role", StringComparison.OrdinalIgnoreCase)).ToList()) esc[key] = "Admin";
    var escB64 = B64Encode(Encoding.UTF8.GetBytes(esc.ToJsonString()));
    var rp = reader.Token!.Split('.');
    forged.Add(("Reader sửa token thành Admin, giữ chữ ký cũ", $"Bearer {rp[0]}.{escB64}.{rp[2]}"));
    forged.Add(("Reader sửa token thành Admin, alg=none", $"Bearer {algNone}.{escB64}."));
    forged.Add(("Reader sửa token thành Admin, ký bằng khóa khác", "Bearer " + Hmac(hs256, escB64, WrongKey)));

    // (2) Giả đúng người, đúng vai trò thật của Admin. Lúc này CHỈ CÓ chữ ký ngăn được kẻ tấn công
    var ap = admin.Token!.Split('.');
    var adm = PayloadOf(admin.Token!);
    var admB64 = B64Encode(Encoding.UTF8.GetBytes(adm.ToJsonString()));
    var admLong = PayloadOf(admin.Token!);
    admLong["exp"] = admLong["exp"]!.GetValue<long>() + 3600;           // chỉ kéo dài hạn dùng, mọi thứ khác giữ nguyên
    var admLongB64 = B64Encode(Encoding.UTF8.GetBytes(admLong.ToJsonString()));
    forged.Add(("Admin giả: kéo dài hạn token, giữ chữ ký cũ", $"Bearer {ap[0]}.{admLongB64}.{ap[2]}"));
    forged.Add(("Admin giả: đúng người đúng vai trò, alg=none", $"Bearer {algNone}.{admB64}."));
    forged.Add(("Admin giả: đúng người đúng vai trò, ký bằng khóa khác", "Bearer " + Hmac(hs256, admB64, WrongKey)));

    // (3) Chuỗi sai định dạng
    forged.Add(("Chuỗi rác 'abc.def.ghi'", "Bearer abc.def.ghi"));
    forged.Add(("Chuỗi rác không có dấu chấm", "Bearer khongphaitoken"));
    forged.Add(("Sai kiểu xác thực (Basic)", "Basic YWRtaW46QWRtaW5AMTIz"));

    foreach (var (name, header) in forged)
    {
        rec.Add($"{name} → GET /api/Auth/me", "—", (await api.Send(null, "GET", "/api/Auth/me", rawAuth: header)).Status, "401");
        rec.Add($"{name} → GET /api/admin/users", "—", (await api.Send(null, "GET", "/api/admin/users", rawAuth: header)).Status, "401");
    }

    // ===== G. Chương ẩn =====
    rec.Group("G. Chương bị ẩn không lộ ra cho người đọc");
    var hid = await api.Send(admin, "GET", $"/api/admin/chapters/{chapterHidden}");
    rec.AddBool("Admin vẫn xem được chương ẩn (isHidden = true)", hid.Status == 200 && hid.Body.Replace(" ", "").Contains("\"isHidden\":true", StringComparison.OrdinalIgnoreCase), "200 + isHidden", $"{hid.Status}");
    foreach (var (who, name) in new[] { (guest, "Khách"), (reader, "Reader") })
    {
        rec.Add($"{name} mở chương ẩn GET /api/Chapters/{{id}}", "—", (await api.Send(who, "GET", $"/api/Chapters/{chapterHidden}")).Status, "404");
        rec.Add($"{name} tăng lượt xem chương ẩn", "—", (await api.Send(who, "POST", $"/api/Chapters/{chapterHidden}/view")).Status, "404");
        var list = await api.Send(who, "GET", $"/api/Comics/{comicId}/chapters");
        rec.AddBool($"{name}: danh sách chương của truyện KHÔNG chứa chương ẩn", list.Status == 200 && !list.BodyHasId(chapterHidden), "không có id " + chapterHidden, list.BodyHasId(chapterHidden) ? "LỘ chương ẩn" : "không lộ");
    }
    await api.Send(admin, "PATCH", $"/api/admin/chapters/{chapterHidden}/toggle-hidden");     // hiện chương
    rec.Add("Chương vừa được hiện: Khách mở được", "—", (await api.Send(guest, "GET", $"/api/Chapters/{chapterHidden}")).Status, "200");
    await api.Send(admin, "PATCH", $"/api/admin/chapters/{chapterHidden}/toggle-hidden");     // ẩn lại
    rec.Add("Ẩn lại: Khách lại không mở được", "—", (await api.Send(guest, "GET", $"/api/Chapters/{chapterHidden}")).Status, "404");

    // ===== F. Trạng thái tài khoản (khóa, đổi quyền có hiệu lực ngay) =====
    rec.Group("F. Khóa tài khoản và đổi quyền có hiệu lực ngay (11.1)");
    try
    {
        var lockR = await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/lock", new { isLocked = true });
        rec.Add("PUT /api/admin/users/{id}/lock", "Admin", lockR.Status, "2xx", group: GC);
        var me = await api.Send(victim, "GET", "/api/Auth/me");
        rec.Add("Đang bị khóa: token cũ gọi /api/Auth/me", "—", me.Status, "401");
        rec.AddBool("Đang bị khóa: nội dung báo mã account_locked", me.Body.Contains("account_locked"), "account_locked", me.Body.Contains("account_locked") ? "có" : "không có");
        rec.Add("Đang bị khóa: token cũ gọi /api/Follows", "—", (await api.Send(victim, "GET", "/api/Follows")).Status, "401");
        rec.Add("Đang bị khóa: đăng nhập lại", "—", (await Login(new Actor("t", victim.Username, victim.Password))).Status, "403");
        rec.Add("Tài khoản bị khóa sẵn (docgia99) đăng nhập", "—", (await Login(new Actor("t", "docgia99", opt.ReaderPass))).Status, "403");

        await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/lock", new { isLocked = false });
        rec.Add("Mở khóa: token cũ dùng lại được", "—", (await api.Send(victim, "GET", "/api/Auth/me")).Status, "200");

        var roleUp = await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/role", new { role = "Admin" });
        rec.Add("PUT /api/admin/users/{id}/role", "Admin", roleUp.Status, "2xx", group: GC);
        var old = await api.Send(victim, "GET", "/api/Auth/me");
        rec.Add("Vừa đổi quyền: token cũ bị từ chối", "—", old.Status, "401");
        rec.AddBool("Vừa đổi quyền: nội dung báo mã role_changed", old.Body.Contains("role_changed"), "role_changed", old.Body.Contains("role_changed") ? "có" : "không có");
        await Login(victim);
        rec.Add("Sau khi lên Admin và đăng nhập lại: vào được /api/admin/users", "—", (await api.Send(victim, "GET", "/api/admin/users")).Status, "200");

        // Quy tắc tự bảo vệ: thử bằng docgia30 (đang là Admin tạm thời) để lỡ có lỗi thì không khóa nhầm tài khoản admin thật
        rec.Add("Admin tự khóa chính mình", "—", (await api.Send(victim, "PUT", $"/api/admin/users/{victim.Id}/lock", new { isLocked = true })).Status, "400", group: GF2);
        rec.Add("Admin tự đổi quyền của chính mình", "—", (await api.Send(victim, "PUT", $"/api/admin/users/{victim.Id}/role", new { role = "Reader" })).Status, "400", group: GF2);
        rec.Add("Đổi quyền sang giá trị lạ 'Superuser'", "—", (await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/role", new { role = "Superuser" })).Status, "400", group: GF2);
        rec.Add("Khóa người dùng không tồn tại", "—", (await api.Send(admin, "PUT", $"/api/admin/users/{NoSuchId}/lock", new { isLocked = true })).Status, "404", group: GF2);

        await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/role", new { role = "Reader" });
        rec.Add("Bị hạ về Reader: token Admin cũ lập tức vô hiệu", "—", (await api.Send(victim, "GET", "/api/admin/users")).Status, "401");
        await Login(victim);
        rec.Add("Đăng nhập lại sau khi bị hạ quyền: không vào được /api/admin/users", "—", (await api.Send(victim, "GET", "/api/admin/users")).Status, "403");
    }
    finally
    {
        // Luôn khôi phục tài khoản thử về Reader và mở khóa, kể cả khi bài test bị lỗi giữa chừng
        await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/lock", new { isLocked = false });
        await api.Send(admin, "PUT", $"/api/admin/users/{victim.Id}/role", new { role = "Reader" });
    }

    // ===== H. Tự gán quyền khi đăng ký =====
    rec.Group("H. Không tự nâng quyền khi đăng ký");
    if (opt.SkipRegister) rec.Info("Bỏ qua (--skip-register)");
    else
    {
        var uname = "perm_" + DateTime.Now.ToString("yyMMddHHmmss");
        var reg = await api.Send(null, "POST", "/api/Auth/register", new { username = uname, email = uname + "@example.com", password = "Perm@12345", role = "Admin", isAdmin = true, isLocked = false });
        if (reg.Status == 429) rec.Info("Đăng ký bị giới hạn tốc độ (429), bỏ qua nhóm này. Chạy lại sau hoặc nâng RateLimits:Register.");
        else
        {
            rec.Add("Đăng ký có kèm role=Admin trong nội dung gửi lên", "—", reg.Status, "2xx");
            var role = reg.Json?["user"]?["role"]?.ToString();
            rec.AddBool("Tài khoản mới chỉ là Reader, không phải Admin", role == "Reader", "Reader", role ?? "(không có)");
            var tok = new Actor("Mới") { Token = reg.Json?["token"]?.ToString() };
            rec.Add("Tài khoản mới vào /api/admin/users", "—", (await api.Send(tok, "GET", "/api/admin/users")).Status, "403");
            var newId = reg.Json?["user"]?["id"]?.GetValue<int>() ?? 0;
            if (newId != 0) await api.Send(admin, "PUT", $"/api/admin/users/{newId}/lock", new { isLocked = true });
            rec.Info($"Đã khóa tài khoản thử {uname} (xóa hẳn bằng SQL: DELETE FROM users WHERE Username LIKE 'perm\\_%';)");
        }
    }

    // ===== I. Header, CORS, tệp lộ =====
    rec.Group("I. Header, CORS và tệp không được lộ");
    var evil = new Dictionary<string, string> { ["Origin"] = "https://evil.example" };
    var cors = await api.Send(guest, "GET", "/api/Comics?pageSize=1", headers: evil);
    rec.AddBool("Trang web lạ gọi API: không có Access-Control-Allow-Origin", cors.Header("access-control-allow-origin") is null, "không có header", cors.Header("access-control-allow-origin") ?? "không có");
    var pre = await api.Send(guest, "OPTIONS", "/api/admin/users", headers: new Dictionary<string, string> { ["Origin"] = "https://evil.example", ["Access-Control-Request-Method"] = "DELETE" });
    rec.AddBool("Preflight từ trang lạ: không được cho phép", pre.Header("access-control-allow-origin") is null, "không có header", pre.Header("access-control-allow-origin") ?? "không có");
    var hdr = await api.Send(reader, "GET", "/api/Auth/me");
    rec.AddBool("API có X-Content-Type-Options: nosniff", hdr.Header("x-content-type-options") == "nosniff", "nosniff", hdr.Header("x-content-type-options") ?? "thiếu");
    rec.AddBool("API có Cache-Control no-store", (hdr.Header("cache-control") ?? "").Contains("no-store"), "no-store", hdr.Header("cache-control") ?? "thiếu");
    rec.AddBool("Không lộ header Server", hdr.Header("server") is null, "không có", hdr.Header("server") ?? "không có");
    foreach (var p in new[] { "/appsettings.json", "/appsettings.Development.json", "/ComicApi.csproj", "/Program.cs", "/logs/", "/uploads/" })
        rec.Add($"GET {p} (tệp cấu hình/mã nguồn/thư mục)", "—", (await api.Send(guest, "GET", p)).Status, "404");
    var sw = await api.Send(guest, "GET", "/swagger/index.html");
    rec.Info($"Swagger /swagger/index.html = {sw.Status} " + (sw.Status == 200 ? "(chấp nhận khi đang Development; khi chạy thật phải là 404)" : "(đã tắt)"));
}
finally
{
    // ===== Dọn dữ liệu thử =====
    rec.Info("Dọn dữ liệu thử...");
    foreach (var id in new[] { chapterVisible, chapterHidden })
        if (id != 0) rec.Add("DELETE /api/admin/chapters/{id}", "Admin", (await api.Send(admin, "DELETE", $"/api/admin/chapters/{id}")).Status, "2xx", group: GC);
    foreach (var id in new[] { comicId, comic2Id })
        if (id != 0) rec.Add("DELETE /api/admin/comics/{id}", "Admin", (await api.Send(admin, "DELETE", $"/api/admin/comics/{id}")).Status, "2xx", group: GC);
}

// ---------------------------------------------------------------------------------------------
Console.WriteLine();
Console.ForegroundColor = rec.Failures == 0 ? ConsoleColor.Green : ConsoleColor.Red;
Console.WriteLine($"TỔNG KẾT: {rec.Checks.Count - rec.Failures}/{rec.Checks.Count} phép thử đạt" + (rec.Failures == 0 ? "" : $", {rec.Failures} LỖI"));
Console.ResetColor();
foreach (var c in rec.Checks.Where(c => !c.Pass))
    Console.WriteLine($"  ✗ [{c.Col}] {c.Label}: nhận {c.Actual}, cần {c.Expect}   ({c.Group})");

rec.WriteMarkdown(opt.Report, opt.Url);
Console.WriteLine($"\nBáo cáo: {Path.GetFullPath(opt.Report)}");
return rec.Failures == 0 ? 0 : 1;

// ---------------------------------------------------------------------------------------------
static byte[] B64Decode(string s)
{
    s = s.Replace('-', '+').Replace('_', '/');
    s += new string('=', (4 - s.Length % 4) % 4);
    return Convert.FromBase64String(s);
}

static string B64Encode(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

record Options(string Url, bool SkipCert, string Report, string AdminPass, string ReaderPass, bool SkipRegister)
{
    public static Options Parse(string[] args)
    {
        string Get(string name, string def)
        {
            var i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : def;
        }
        return new Options(
            Get("--url", "https://localhost:7046").TrimEnd('/'),
            args.Contains("--skip-cert"),
            Get("--report", "auth-test-report.md"),
            Get("--admin-pass", "Admin@123"),
            Get("--reader-pass", "Reader@123"),
            args.Contains("--skip-register"));
    }
}
