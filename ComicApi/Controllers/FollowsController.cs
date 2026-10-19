using ComicApi.DTOs.Social;
using ComicApi.Extensions;
using ComicApi.Models;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FollowsController : ControllerBase
{
    private readonly IFollowRepository _follows;
    private readonly IComicRepository _comics;

    public FollowsController(IFollowRepository follows, IComicRepository comics)
    {
        _follows = follows;
        _comics = comics;
    }

    // Id của người đang đăng nhập, lấy từ token
    private int CurrentUserId => User.GetUserId() ?? 0;

    private async Task<FollowStatusDto> BuildStatusAsync(int comicId) => new()
    {
        IsFollowing = await _follows.IsFollowingAsync(CurrentUserId, comicId),
        FollowCount = await _follows.CountByComicAsync(comicId)
    };

    // GET /api/Follows?page=1&pageSize=12
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int page = 1, [FromQuery] int pageSize = 12) =>
        Ok(await _follows.GetFollowedComicsAsync(CurrentUserId, page, pageSize));

    [HttpGet("{comicId:int}/status")]
    public async Task<IActionResult> Status(int comicId)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        return Ok(await BuildStatusAsync(comicId));
    }

    [HttpPost("{comicId:int}")]
    public async Task<IActionResult> Follow(int comicId)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        // Theo dõi rồi thì không làm gì thêm (bấm nhiều lần cũng không lỗi)
        if (!await _follows.IsFollowingAsync(CurrentUserId, comicId))
        {
            await _follows.AddAsync(new Follow { UserId = CurrentUserId, ComicId = comicId });
            try
            {
                await _follows.SaveAsync();
            }
            catch (DbUpdateException)
            {
                // Hai yêu cầu cùng lúc: dòng đã được tạo bởi yêu cầu kia, bỏ qua
            }
        }

        return Ok(await BuildStatusAsync(comicId));
    }

    [HttpDelete("{comicId:int}")]
    public async Task<IActionResult> Unfollow(int comicId)
    {
        if (!await _comics.ExistsAsync(comicId))
            return NotFound(new { message = "Không tìm thấy truyện" });

        var follow = await _follows.GetAsync(CurrentUserId, comicId);
        if (follow is not null)
        {
            _follows.Delete(follow);
            await _follows.SaveAsync();
        }

        return Ok(await BuildStatusAsync(comicId));
    }
}