using System.Linq.Expressions;
using ComicApi.Data;
using ComicApi.DTOs;
using ComicApi.DTOs.Common;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public class CommentRepository : Repository<Comment>, ICommentRepository
{
    private const int PreviewReplies = 2;      // số phản hồi trả sẵn kèm mỗi bình luận gốc

    public CommentRepository(AppDbContext db) : base(db) { }

    // Chuyển Comment -> CommentDto (dùng chung cho bình luận gốc và phản hồi)
    private static Expression<Func<Comment, CommentDto>> ToDto(int uid) => c => new CommentDto
    {
        Id = c.Id,
        UserId = c.UserId,
        Username = c.User.Username,
        Content = c.Content,
        GifUrl = c.GifUrl,
        CreatedAt = c.CreatedAt,
        ParentId = c.ParentId,
        ReplyToUsername = c.ReplyToUser != null ? c.ReplyToUser.Username : null,
        LikeCount = c.Likes.Count,
        LikedByMe = c.Likes.Any(l => l.UserId == uid),      // uid = 0 khi chưa đăng nhập, không ai trùng
        ReplyCount = c.Replies.Count
    };

    public async Task<CommentPageDto> GetByComicAsync(
        int comicId, int page, int pageSize, string? sort, int? userId)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var uid = userId ?? 0;

        var roots = _db.Comments.AsNoTracking().Where(c => c.ComicId == comicId && c.ParentId == null);
        var totalRoots = await roots.CountAsync();
        var totalAll = await _db.Comments.CountAsync(c => c.ComicId == comicId);

        var ordered = sort switch
        {
            "top" => roots.OrderByDescending(c => c.Likes.Count).ThenByDescending(c => c.CreatedAt),
            "oldest" => roots.OrderBy(c => c.CreatedAt),
            _ => roots.OrderByDescending(c => c.CreatedAt)
        };

        var items = await ordered.ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(ToDto(uid))
            .ToListAsync();

        // Lấy phản hồi của cả trang bằng MỘT truy vấn, rồi giữ vài phản hồi đầu của từng chủ đề
        var ids = items.Select(i => i.Id).ToList();
        if (ids.Count > 0)
        {
            var replies = await _db.Comments.AsNoTracking()
                .Where(c => ids.Contains(c.ParentId ?? 0))
                .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)
                .Select(ToDto(uid))
                .ToListAsync();

            var byParent = replies.GroupBy(r => r.ParentId!.Value)
                                  .ToDictionary(g => g.Key, g => g.Take(PreviewReplies).ToList());

            foreach (var item in items)
                if (byParent.TryGetValue(item.Id, out var list)) item.Replies = list;
        }

        return new CommentPageDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalRoots,
            TotalComments = totalAll
        };
    }

    public async Task<PagedResult<CommentDto>> GetRepliesAsync(int parentId, int page, int pageSize, int? userId)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _db.Comments.AsNoTracking().Where(c => c.ParentId == parentId);
        var total = await query.CountAsync();

        var items = await query
            .OrderBy(c => c.CreatedAt).ThenBy(c => c.Id)          // phản hồi cũ trước, đọc như một cuộc trò chuyện
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(ToDto(userId ?? 0))
            .ToListAsync();

        return new PagedResult<CommentDto> { Items = items, Page = page, PageSize = pageSize, TotalItems = total };
    }

    // Trả về số lượt thích mới của bình luận. Gọi lặp lại không gây lỗi
    public async Task<int> SetLikeAsync(int userId, int commentId, bool liked)
    {
        if (liked)
        {
            var exists = await _db.CommentLikes.AnyAsync(l => l.UserId == userId && l.CommentId == commentId);
            if (!exists)
            {
                _db.CommentLikes.Add(new CommentLike { UserId = userId, CommentId = commentId });
                try { await _db.SaveChangesAsync(); }
                catch (DbUpdateException) { _db.ChangeTracker.Clear(); }   // hai yêu cầu đến cùng lúc: bỏ qua cái trùng
            }
        }
        else
        {
            await _db.CommentLikes
                .Where(l => l.UserId == userId && l.CommentId == commentId)
                .ExecuteDeleteAsync();
        }

        return await _db.CommentLikes.CountAsync(l => l.CommentId == commentId);
    }
}