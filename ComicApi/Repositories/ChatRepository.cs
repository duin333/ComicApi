using ComicApi.Data;
using ComicApi.DTOs.Chat;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IChatRepository : IRepository<Comic>
{
    Task<List<ChatComicInfo>> GetCatalogAsync();
    Task<int> CountCommentsAsync(int comicId);
    Task<List<string>> GetRecentCommentsAsync(int comicId, int take);
}

public class ChatRepository : Repository<Comic>, IChatRepository
{
    public ChatRepository(AppDbContext db) : base(db) { }

    // Toàn bộ truyện kèm thể loại, mô tả, số chương hiển thị. Việc lọc và xếp hạng làm trong bộ nhớ
    // (không phụ thuộc vào cách MySQL so sánh dấu tiếng Việt). Với dữ liệu lớn hơn nên dùng full-text hoặc embedding.
    public Task<List<ChatComicInfo>> GetCatalogAsync() =>
        _set.AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => new ChatComicInfo
            {
                Id = c.Id,
                Title = c.Title,
                Author = c.Author,
                Status = c.Status,
                Description = c.Description,
                CoverUrl = c.CoverUrl,
                ViewCount = c.ViewCount,
                UpdatedAt = c.UpdatedAt,
                ChapterCount = c.Chapters.Count(ch => !ch.IsHidden),
                Genres = c.ComicGenres.Select(cg => cg.Genre.Name).ToList()
            })
            .ToListAsync();

    public Task<int> CountCommentsAsync(int comicId) =>
        _db.Comments.CountAsync(c => c.ComicId == comicId);

    public Task<List<string>> GetRecentCommentsAsync(int comicId, int take) =>
        _db.Comments.AsNoTracking()
            .Where(c => c.ComicId == comicId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(take)
            .Select(c => c.Content)
            .ToListAsync();
}
