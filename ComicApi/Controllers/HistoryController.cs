using ComicApi.Extensions;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HistoryController : ControllerBase
{
    private readonly IReadingHistoryRepository _history;

    public HistoryController(IReadingHistoryRepository history) => _history = history;

    private int CurrentUserId => User.GetUserId() ?? 0;

    // GET /api/History?page=1&pageSize=12
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int page = 1, [FromQuery] int pageSize = 12) =>
        Ok(await _history.GetByUserAsync(CurrentUserId, page, pageSize));

    // Chương đọc gần nhất của 1 truyện (để làm nút "Đọc tiếp"). Chưa đọc thì trả 204
    [HttpGet("comics/{comicId:int}")]
    public async Task<IActionResult> GetForComic(int comicId)
    {
        var item = await _history.GetForComicAsync(CurrentUserId, comicId);
        return item is null ? NoContent() : Ok(item);
    }

    // Giao diện gọi khi người dùng mở một chương
    [HttpPost("chapters/{chapterId:int}")]
    public async Task<IActionResult> Save(int chapterId) =>
        await _history.SaveProgressAsync(CurrentUserId, chapterId)
            ? NoContent()
            : NotFound(new { message = "Không tìm thấy chương" });

    [HttpDelete("comics/{comicId:int}")]
    public async Task<IActionResult> RemoveOne(int comicId)
    {
        await _history.RemoveForComicAsync(CurrentUserId, comicId);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Clear()
    {
        await _history.ClearAsync(CurrentUserId);
        return NoContent();
    }
}