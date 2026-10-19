using ComicApi.Data;
using ComicApi.DTOs.Common;
using ComicApi.DTOs.Social;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface ICommentRepository : IRepository<Comment>
{
    Task<PagedResult<CommentDto>> GetByComicAsync(int comicId, int page, int pageSize);
}

public class CommentRepository : Repository<Comment>, ICommentRepository
{
    public CommentRepository(AppDbContext db) : base(db) { }

    public async Task<PagedResult<CommentDto>> GetByComicAsync(int comicId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var q = _set.AsNoTracking().Where(c => c.ComicId == comicId);
        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)   // mới nhất trước
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CommentDto
            {
                Id = c.Id,
                UserId = c.UserId,
                Username = c.User.Username,
                Content = c.Content,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<CommentDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }
}