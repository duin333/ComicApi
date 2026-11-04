using ComicApi.DTOs.Social;
using ComicApi.Extensions;
using ComicApi.Models;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ComicApi.Services;

namespace ComicApi.Controllers;

[ApiController]
[Route("api")]
public class CommentsController : ControllerBase
{
    private readonly ICommentRepository _comments;
    private readonly IComicRepository _comics;
    private readonly IUserRepository _users;

    public CommentsController(ICommentRepository comments, IComicRepository comics, IUserRepository users)
    {
        _comments = comments;
        _comics = comics;
        _users = users;
    }

    // Ai cũng xem được bình luận
    // GET /api/comics/{comicId}/comments?page=&pageSize=&sort=newest|top|oldest
    [HttpGet("comics/{comicId:int}/comments")]
    public async Task<IActionResult> GetByComic(
        int comicId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? sort = null)
    {
        // (giữ nguyên đoạn kiểm tra truyện có tồn tại như cũ nếu bạn đã có)
        return Ok(await _comments.GetByComicAsync(comicId, page, pageSize, sort, User.GetUserId()));
    }

    [Authorize]
    [HttpPost("comics/{comicId:int}/comments")]

    public async Task<IActionResult> Create(int comicId, CommentCreateDto dto)
    {
        var content = (dto.Content ?? string.Empty).Trim();
        var gifUrl = string.IsNullOrWhiteSpace(dto.GifUrl) ? null : dto.GifUrl.Trim();

        // Phải có chữ hoặc có GIF (hoặc cả hai)
        if (content.Length == 0 && gifUrl is null)
            return BadRequest(new { message = "Hãy nhập nội dung hoặc chọn một ảnh GIF" });

        if (gifUrl is not null && !GifUrlValidator.IsAllowed(gifUrl))
            return BadRequest(new { message = "Ảnh GIF không hợp lệ (chỉ nhận GIF trong thư viện của website hoặc từ Giphy, Tenor)" });

        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        var user = await _users.GetByIdAsync(User.GetUserId() ?? 0);
        if (user is null || user.IsLocked)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Tài khoản đã bị khóa" });
        
        // 10.13: đây là phản hồi?
        int? parentId = null;
        int? replyToUserId = null;
        string? replyToUsername = null;

        if (dto.ParentId.HasValue)
        {
            var target = await _comments.GetByIdAsync(dto.ParentId.Value);
            if (target is null || target.ComicId != comicId)
                return BadRequest(new { message = "Không tìm thấy bình luận cần trả lời" });

            // Chỉ có hai cấp: trả lời một phản hồi thì gắn vào bình luận gốc và nhắc tên người đó
            parentId = target.ParentId ?? target.Id;
            if (target.ParentId != null)
            {
                replyToUserId = target.UserId;
                replyToUsername = (await _users.GetByIdAsync(target.UserId))?.Username;
            }
        }

        var comment = new Comment { UserId = user.Id, ComicId = comicId, Content = content, GifUrl = gifUrl };
        await _comments.AddAsync(comment);
        await _comments.SaveAsync();

        var result = new CommentDto
        {
            Id = comment.Id,
            UserId = user.Id,
            Username = user.Username,
            Content = comment.Content,
            GifUrl = comment.GifUrl,
            CreatedAt = comment.CreatedAt
        };
        return Created($"/api/comics/{comicId}/comments", result);
    }

    // Chủ bình luận hoặc Admin mới được xóa
    [Authorize]
    [HttpDelete("comments/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var comment = await _comments.GetByIdAsync(id);
        if (comment is null)
            return NotFound(new { message = "Không tìm thấy bình luận" });

        var isOwner = comment.UserId == User.GetUserId();
        if (!isOwner && !User.IsInRole(Roles.Admin))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Bạn chỉ có thể xóa bình luận của mình" });

        _comments.Delete(comment);
        await _comments.SaveAsync();
        return NoContent();
    }

    // GET /api/comments/{id}/replies?page=&pageSize=   (phản hồi của một bình luận gốc, cũ trước)
    [HttpGet("comments/{id:int}/replies")]
    public async Task<IActionResult> GetReplies(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (await _comments.GetByIdAsync(id) is null)
            return NotFound(new { message = "Không tìm thấy bình luận" });

        return Ok(await _comments.GetRepliesAsync(id, page, pageSize, User.GetUserId()));
    }

    [Authorize]
    [HttpPut("comments/{id:int}/like")]
    public Task<IActionResult> Like(int id) => SetLike(id, true);

    [Authorize]
    [HttpDelete("comments/{id:int}/like")]
    public Task<IActionResult> Unlike(int id) => SetLike(id, false);

    private async Task<IActionResult> SetLike(int id, bool liked)
    {
        if (await _comments.GetByIdAsync(id) is null)
            return NotFound(new { message = "Không tìm thấy bình luận" });

        var user = await _users.GetByIdAsync(User.GetUserId() ?? 0);
        if (user is null || user.IsLocked)
            return StatusCode(403, new { message = "Tài khoản đã bị khóa" });

        var count = await _comments.SetLikeAsync(user.Id, id, liked);
        return Ok(new { liked, likeCount = count });
    }
}