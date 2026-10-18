using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // Đã có dữ liệu mẫu thì thôi, tránh nạp trùng mỗi lần chạy
        if (await db.Genres.AnyAsync()) return;

        // Xóa truyện thử nghiệm bạn thêm bằng tay ở Workbench
        db.Comics.RemoveRange(db.Comics);

        // 1. Tài khoản
        var admin = new User
        {
            Username = "admin",
            Email = "admin@comic.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role = Roles.Admin
        };
        var reader = new User
        {
            Username = "reader1",
            Email = "reader1@comic.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Reader@123"),
            Role = Roles.Reader
        };
        db.Users.AddRange(admin, reader);

        // 2. Thể loại
        var genres = new[]
        {
            "Hành động", "Phiêu lưu", "Tình cảm", "Hài hước",
            "Kinh dị", "Học đường", "Viễn tưởng", "Cổ đại"
        }.Select(n => new Genre { Name = n }).ToList();
        db.Genres.AddRange(genres);

        await db.SaveChangesAsync();   // lưu để admin, reader, genres có Id

        // 3. Truyện (GenreIdx là chỉ số thể loại trong danh sách ở trên)
        var data = new[]
        {
            new { Title = "Kiếm Khách Vô Danh", Author = "Lâm Phong", Status = "Ongoing",   GenreIdx = new[] { 0, 7 },
                  Desc = "Một kiếm khách mất trí nhớ lang thang khắp giang hồ để tìm lại thân phận của mình." },
            new { Title = "Học Viện Ma Pháp", Author = "Thu Hà", Status = "Ongoing",       GenreIdx = new[] { 1, 5, 6 },
                  Desc = "Cô học trò bình thường bất ngờ được nhận vào học viện ma pháp danh tiếng nhất vương quốc." },
            new { Title = "Mèo Thần Tài", Author = "Minh Khôi", Status = "Completed",      GenreIdx = new[] { 3 },
                  Desc = "Chú mèo béo mang lại may mắn cho cả khu phố, nhưng chỉ khi được cho ăn đúng giờ." },
            new { Title = "Thế Giới Sau Cơn Mưa", Author = "Bảo Anh", Status = "Ongoing",  GenreIdx = new[] { 2, 5 },
                  Desc = "Hai người xa lạ gặp nhau dưới mái hiên trong một chiều mưa và câu chuyện bắt đầu từ đó." },
            new { Title = "Cô Nàng Lớp Trưởng", Author = "Ngọc Lan", Status = "Completed", GenreIdx = new[] { 2, 3, 5 },
                  Desc = "Lớp trưởng nghiêm khắc có một bí mật khiến cả lớp bất ngờ." },
            new { Title = "Đêm Trăng Quỷ Dữ", Author = "Hắc Vũ", Status = "Ongoing",       GenreIdx = new[] { 4, 0 },
                  Desc = "Mỗi đêm trăng tròn, ngôi làng nhỏ lại mất đi một người." },
            new { Title = "Hiệp Sĩ Tinh Không", Author = "Quang Huy", Status = "Ongoing",  GenreIdx = new[] { 0, 1, 6 },
                  Desc = "Phi hành đoàn cuối cùng của thiên hà chiến đấu để bảo vệ Trái Đất." },
            new { Title = "Tiệm Cà Phê Ma", Author = "Thanh Mai", Status = "Completed",    GenreIdx = new[] { 3, 4 },
                  Desc = "Quán cà phê chỉ mở lúc nửa đêm, và khách quen đều không còn sống." },
            new { Title = "Công Chúa Và Rồng", Author = "Phương Linh", Status = "Ongoing", GenreIdx = new[] { 1, 2, 7 },
                  Desc = "Công chúa bỏ trốn khỏi hôn ước và kết bạn với một con rồng lạc đàn." },
            new { Title = "Thám Tử Học Đường", Author = "Đức Trí", Status = "Ongoing",     GenreIdx = new[] { 1, 5 },
                  Desc = "Câu lạc bộ trinh thám của trường giải quyết những vụ án kỳ lạ trong khuôn viên." },
        };

        var rnd = new Random(42);   // seed cố định để mỗi lần nạp ra cùng dữ liệu
        for (int i = 0; i < data.Length; i++)
        {
            var d = data[i];
            var comic = new Comic
            {
                Title = d.Title,
                Author = d.Author,
                Description = d.Desc,
                Status = d.Status,
                CoverUrl = $"https://picsum.photos/seed/cover{i}/400/600",
                ViewCount = rnd.Next(500, 50000),
                CreatedAt = DateTime.UtcNow.AddDays(-30 + i),
                UpdatedAt = DateTime.UtcNow.AddDays(-i),   // truyện đầu tiên mới cập nhật nhất
                UploaderId = admin.Id
            };

            foreach (var gi in d.GenreIdx)
                comic.ComicGenres.Add(new ComicGenre { Genre = genres[gi] });

            for (int c = 1; c <= 3; c++)
            {
                var chapter = new Chapter
                {
                    Number = c,
                    Title = $"Chương {c}",
                    ViewCount = rnd.Next(100, 5000)
                };
                for (int p = 1; p <= 5; p++)
                    chapter.Images.Add(new ChapterImage
                    {
                        ImageUrl = $"https://picsum.photos/seed/c{i}-{c}-{p}/800/1200",
                        SortOrder = p
                    });
                comic.Chapters.Add(chapter);
            }
            db.Comics.Add(comic);
        }
        await db.SaveChangesAsync();

        // 4. Bình luận mẫu và 1 lượt theo dõi (cho 3 truyện đầu)
        var firstThree = await db.Comics.OrderBy(c => c.Id).Take(3).ToListAsync();
        db.Comments.AddRange(
            new Comment { UserId = reader.Id, ComicId = firstThree[0].Id, Content = "Truyện hay, vẽ đẹp, mong ra chương mới sớm!" },
            new Comment { UserId = admin.Id, ComicId = firstThree[0].Id, Content = "Cảm ơn bạn đã ủng hộ, chương mới sẽ ra vào cuối tuần." },
            new Comment { UserId = reader.Id, ComicId = firstThree[1].Id, Content = "Cốt truyện hấp dẫn nhưng nhịp hơi chậm ở chương 2." },
            new Comment { UserId = reader.Id, ComicId = firstThree[2].Id, Content = "Đọc mà cười suốt, bé mèo quá dễ thương." }
        );
        db.Follows.Add(new Follow { UserId = reader.Id, ComicId = firstThree[0].Id });

        await db.SaveChangesAsync();
    }
}