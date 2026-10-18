using ComicApi.Data;
using ComicApi.DTOs.Common;
using ComicApi.DTOs.Comics;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IComicRepository : IRepository<Comic>
{
    Task<PagedResult<ComicListItemDto>> SearchAsync(ComicQueryParams p);
    Task<ComicDetailDto?> GetDetailAsync(int id);
    Task<bool> ExistsAsync(int id);
}

public class ComicRepository : Repository<Comic>, IComicRepository
{
    public ComicRepository(AppDbContext db) : base(db) { }

    public async Task<PagedResult<ComicListItemDto>> SearchAsync(ComicQueryParams p)
    {
        var page = Math.Max(1, p.Page);
        var size = Math.Clamp(p.PageSize, 1, 50);

        var q = _set.AsNoTracking().AsQueryable();

        // 1. Lọc (mỗi điều kiện chỉ thêm vào khi client có gửi)
        if (!string.IsNullOrWhiteSpace(p.Keyword))
        {
            var k = p.Keyword.Trim();
            q = q.Where(c => c.Title.Contains(k) || (c.Author != null && c.Author.Contains(k)));
        }
        if (p.GenreId.HasValue)
            q = q.Where(c => c.ComicGenres.Any(cg => cg.GenreId == p.GenreId.Value));
        if (!string.IsNullOrWhiteSpace(p.Status))
            q = q.Where(c => c.Status == p.Status);

        // 2. Sắp xếp (thêm ThenBy Id để phân trang ổn định, không bị lặp/sót dòng)
        IOrderedQueryable<Comic> ordered = (p.Sort ?? "").ToLowerInvariant() switch
        {
            "views" => q.OrderByDescending(c => c.ViewCount),
            "newest" => q.OrderByDescending(c => c.CreatedAt),
            "title" => q.OrderBy(c => c.Title),
            _ => q.OrderByDescending(c => c.UpdatedAt)
        };
        ordered = ordered.ThenBy(c => c.Id);

        // 3. Phân trang
        var total = await q.CountAsync();

        var items = await ordered
            .Skip((page - 1) * size)
            .Take(size)
            .Select(c => new ComicListItemDto
            {
                Id = c.Id,
                Title = c.Title,
                Author = c.Author,
                CoverUrl = c.CoverUrl,
                Status = c.Status,
                ViewCount = c.ViewCount,
                UpdatedAt = c.UpdatedAt,
                Genres = c.ComicGenres.Select(cg => cg.Genre.Name).ToList(),
                ChapterCount = c.Chapters.Count(ch => !ch.IsHidden),
                LatestChapterNumber = c.Chapters.Where(ch => !ch.IsHidden).Max(ch => (int?)ch.Number)
            })
            .ToListAsync();

        return new PagedResult<ComicListItemDto>
        {
            Items = items,
            Page = page,
            PageSize = size,
            TotalItems = total
        };
    }

    public Task<ComicDetailDto?> GetDetailAsync(int id) =>
        _set.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new ComicDetailDto
            {
                Id = c.Id,
                Title = c.Title,
                Description = c.Description,
                Author = c.Author,
                CoverUrl = c.CoverUrl,
                Status = c.Status,
                ViewCount = c.ViewCount,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                Genres = c.ComicGenres
                    .Select(cg => new GenreDto { Id = cg.GenreId, Name = cg.Genre.Name })
                    .ToList(),
                ChapterCount = c.Chapters.Count(ch => !ch.IsHidden),
                FollowCount = c.Follows.Count,
                CommentCount = c.Comments.Count
            })
            .FirstOrDefaultAsync();

    public Task<bool> ExistsAsync(int id) => _set.AnyAsync(c => c.Id == id);
}