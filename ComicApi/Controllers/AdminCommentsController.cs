using ComicApi.Data;
using ComicApi.DTOs.Admin;
using ComicApi.DTOs.Common;
using ComicApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/admin/comments")]
[Authorize(Roles = Roles.Admin)]
public class AdminCommentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminCommentsController(AppDbContext db) => _db = db;

    // Thống kê nhanh cho đầu trang
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var since = DateTime.UtcNow.AddHours(-24);

        return Ok(new
        {
            total = await _db.Comments.CountAsync(),
            withGif = await _db.Comments.CountAsync(c => c.GifUrl != null),
            last24h = await _db.Comments.CountAsync(c => c.CreatedAt >= since),
            fromLockedUsers = await _db.Comments.CountAsync(c => c.User.IsLocked)
        });
    }

    // GET /api/admin/comments?keyword=&hasGif=&locked=&userId=&comicId=&sort=&page=&pageSize=
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] AdminCommentQuery q)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);

        var query = _db.Comments.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q.Keyword))
        {
            var k = q.Keyword.Trim();
            query = query.Where(c =>
                c.Content.Contains(k) || c.User.Username.Contains(k) || c.Comic.Title.Contains(k));
        }
        if (q.ComicId.HasValue) query = query.Where(c => c.ComicId == q.ComicId.Value);
        if (q.UserId.HasValue) query = query.Where(c => c.UserId == q.UserId.Value);
        if (q.HasGif == true) query = query.Where(c => c.GifUrl != null);
        if (q.Locked == true) query = query.Where(c => c.User.IsLocked);

        var total = await query.CountAsync();

        var ordered = q.Sort == "oldest"
            ? query.OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
            : query.OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id);

        var items = await ordered
            .Skip((page - 1) * size)
            .Take(size)
            .Select(c => new AdminCommentDto
            {
                Id = c.Id,
                UserId = c.UserId,
                Username = c.User.Username,
                UserLocked = c.User.IsLocked,
                ComicId = c.ComicId,
                ComicTitle = c.Comic.Title,
                Content = c.Content,
                GifUrl = c.GifUrl,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync();

        return Ok(new PagedResult<AdminCommentDto>
        {
            Items = items,
            Page = page,
            PageSize = size,
            TotalItems = total
        });
    }

    // Xóa nhiều bình luận cùng lúc (tối đa 200)
    [HttpPost("bulk-delete")]
    public async Task<IActionResult> BulkDelete(BulkDeleteRequest request)
    {
        var ids = request.Ids.Distinct().ToList();
        var deleted = await _db.Comments.Where(c => ids.Contains(c.Id)).ExecuteDeleteAsync();
        return Ok(new { deleted });
    }

    // Xóa mọi bình luận của một người (dùng khi gặp tài khoản spam)
    [HttpDelete("by-user/{userId:int}")]
    public async Task<IActionResult> DeleteByUser(int userId)
    {
        var deleted = await _db.Comments.Where(c => c.UserId == userId).ExecuteDeleteAsync();
        return Ok(new { deleted });
    }
}