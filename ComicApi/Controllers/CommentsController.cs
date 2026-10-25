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
    [HttpGet("comics/{comicId:int}/comments")]
    public async Task<IActionResult> GetByComic(
        int comicId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        return Ok(await _comments.GetByComicAsync(comicId, page, pageSize));
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
}