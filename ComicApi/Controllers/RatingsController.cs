using ComicApi.DTOs.Social;
using ComicApi.Extensions;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/comics/{comicId:int}/ratings")]
public class RatingsController : ControllerBase
{
    private readonly IRatingRepository _ratings;
    private readonly IComicRepository _comics;
    private readonly IUserRepository _users;

    public RatingsController(IRatingRepository ratings, IComicRepository comics, IUserRepository users)
    {
        _ratings = ratings;
        _comics = comics;
        _users = users;
    }

    // Ai cũng xem được. Nếu có đăng nhập thì kèm số sao của chính mình
    [HttpGet]
    public async Task<IActionResult> Summary(int comicId)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        return Ok(await _ratings.GetSummaryAsync(comicId, User.GetUserId()));
    }

    [Authorize]
    [HttpPut("mine")]
    public async Task<IActionResult> SetMine(int comicId, RatingRequest request)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        // Kiểm tra lại trong database: tài khoản bị khóa thì không được đánh giá
        var user = await _users.GetByIdAsync(User.GetUserId() ?? 0);
        if (user is null || user.IsLocked)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Tài khoản đã bị khóa" });

        await _ratings.SetAsync(user.Id, comicId, request.Stars);
        return Ok(await _ratings.GetSummaryAsync(comicId, user.Id));
    }

    [Authorize]
    [HttpDelete("mine")]
    public async Task<IActionResult> RemoveMine(int comicId)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        var userId = User.GetUserId() ?? 0;
        await _ratings.RemoveAsync(userId, comicId);
        return Ok(await _ratings.GetSummaryAsync(comicId, userId));
    }
}