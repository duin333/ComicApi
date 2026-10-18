using ComicApi.Data;
using ComicApi.DTOs.Comics;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IChapterRepository : IRepository<Chapter>
{
    Task<List<ChapterListItemDto>> GetByComicAsync(int comicId, bool descending);
    Task<ChapterDetailDto?> GetDetailAsync(int chapterId);
    Task<bool> IncreaseViewAsync(int chapterId);
}

public class ChapterRepository : Repository<Chapter>, IChapterRepository
{
    public ChapterRepository(AppDbContext db) : base(db) { }

    public async Task<List<ChapterListItemDto>> GetByComicAsync(int comicId, bool descending)
    {
        var q = _set.AsNoTracking().Where(c => c.ComicId == comicId && !c.IsHidden);

        q = descending ? q.OrderByDescending(c => c.Number) : q.OrderBy(c => c.Number);

        return await q.Select(c => new ChapterListItemDto
        {
            Id = c.Id,
            Number = c.Number,
            Title = c.Title,
            ViewCount = c.ViewCount,
            CreatedAt = c.CreatedAt
        }).ToListAsync();
    }

    public async Task<ChapterDetailDto?> GetDetailAsync(int chapterId)
    {
        var chapter = await _set.AsNoTracking()
            .Where(c => c.Id == chapterId && !c.IsHidden)
            .Select(c => new ChapterDetailDto
            {
                Id = c.Id,
                ComicId = c.ComicId,
                ComicTitle = c.Comic.Title,
                Number = c.Number,
                Title = c.Title,
                ViewCount = c.ViewCount,
                Images = c.Images
                    .OrderBy(i => i.SortOrder)          // ảnh theo đúng thứ tự trang
                    .Select(i => new ChapterImageDto
                    {
                        Id = i.Id,
                        ImageUrl = i.ImageUrl,
                        SortOrder = i.SortOrder
                    }).ToList()
            })
            .FirstOrDefaultAsync();

        if (chapter is null) return null;

        // Chương trước: chương có số lớn nhất nhưng vẫn nhỏ hơn chương hiện tại
        chapter.PrevChapterId = await _set.AsNoTracking()
            .Where(c => c.ComicId == chapter.ComicId && !c.IsHidden && c.Number < chapter.Number)
            .OrderByDescending(c => c.Number)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();

        // Chương sau: chương có số nhỏ nhất nhưng vẫn lớn hơn chương hiện tại
        chapter.NextChapterId = await _set.AsNoTracking()
            .Where(c => c.ComicId == chapter.ComicId && !c.IsHidden && c.Number > chapter.Number)
            .OrderBy(c => c.Number)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();

        return chapter;
    }

    public async Task<bool> IncreaseViewAsync(int chapterId)
    {
        var comicId = await _set
            .Where(c => c.Id == chapterId && !c.IsHidden)
            .Select(c => (int?)c.ComicId)
            .FirstOrDefaultAsync();

        if (comicId is null) return false;

        // Cộng thẳng trong database (UPDATE ... SET ViewCount = ViewCount + 1)
        // để nhiều người đọc cùng lúc không bị ghi đè số liệu của nhau
        await _set.Where(c => c.Id == chapterId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.ViewCount, c => c.ViewCount + 1));

        await _db.Comics.Where(c => c.Id == comicId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.ViewCount, c => c.ViewCount + 1));

        return true;
    }
}