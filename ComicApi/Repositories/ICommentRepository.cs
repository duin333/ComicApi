using ComicApi.DTOs.Common;
using ComicApi.Models;

namespace ComicApi.Repositories;

public interface ICommentRepository : IRepository<Comment>
{
    Task<CommentPageDto> GetByComicAsync(int comicId, int page, int pageSize, string? sort, int? userId);
    Task<PagedResult<CommentDto>> GetRepliesAsync(int parentId, int page, int pageSize, int? userId);
    Task<int> SetLikeAsync(int userId, int commentId, bool liked);
}