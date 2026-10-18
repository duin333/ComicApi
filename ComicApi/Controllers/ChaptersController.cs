using ComicApi.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChaptersController : ControllerBase
{
    private readonly IChapterRepository _chapters;

    public ChaptersController(IChapterRepository chapters) => _chapters = chapters;

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var chapter = await _chapters.GetDetailAsync(id);
        return chapter is null
            ? NotFound(new { message = "Không tìm thấy chương" })
            : Ok(chapter);
    }

    [HttpPost("{id:int}/view")]
    public async Task<IActionResult> IncreaseView(int id) =>
        await _chapters.IncreaseViewAsync(id)
            ? NoContent()
            : NotFound(new { message = "Không tìm thấy chương" });
}