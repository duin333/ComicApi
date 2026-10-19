using ComicApi.Data;
using ComicApi.DTOs.Common;
using ComicApi.DTOs.Comics;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IFollowRepository : IRepository<Follow>
{
    Task<bool> IsFollowingAsync(int userId, int comicId);
    Task<Follow?> GetAsync(int userId, int comicId);
    Task<int> CountByComicAsync(int comicId);
    Task<PagedResult<ComicListItemDto>> GetFollowedComicsAsync(int userId, int page, int pageSize);
}

public class FollowRepository : Repository<Follow>, IFollowRepository
{
    public FollowRepository(AppDbContext db) : base(db) { }

    public Task<bool> IsFollowingAsync(int userId, int comicId) =>
        _set.AnyAsync(f => f.UserId == userId && f.ComicId == comicId);

    public Task<Follow?> GetAsync(int userId, int comicId) =>
        _set.FirstOrDefaultAsync(f => f.UserId == userId && f.ComicId == comicId);

    public Task<int> CountByComicAsync(int comicId) =>
        _set.CountAsync(f => f.ComicId == comicId);

    public async Task<PagedResult<ComicListItemDto>> GetFollowedComicsAsync(int userId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var q = _set.AsNoTracking().Where(f => f.UserId == userId);
        var total = await q.CountAsync();

        // Dùng lại đúng kiểu dữ liệu thẻ truyện của trang chủ, nên giao diện vẽ lại được bằng UI.comicCard
        var items = await q
            .OrderByDescending(f => f.CreatedAt).ThenByDescending(f => f.ComicId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new ComicListItemDto
            {
                Id = f.Comic.Id,
                Title = f.Comic.Title,
                Author = f.Comic.Author,
                CoverUrl = f.Comic.CoverUrl,
                Status = f.Comic.Status,
                ViewCount = f.Comic.ViewCount,
                UpdatedAt = f.Comic.UpdatedAt,
                Genres = f.Comic.ComicGenres.Select(cg => cg.Genre.Name).ToList(),
                ChapterCount = f.Comic.Chapters.Count(ch => !ch.IsHidden),
                LatestChapterNumber = f.Comic.Chapters.Where(ch => !ch.IsHidden).Max(ch => (int?)ch.Number)
            })
            .ToListAsync();

        return new PagedResult<ComicListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }
}