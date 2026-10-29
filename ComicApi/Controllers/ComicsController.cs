using ComicApi.DTOs.Comics;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComicsController : ControllerBase
{
    private readonly IComicRepository _comics;
    private readonly IChapterRepository _chapters;

    public ComicsController(IComicRepository comics, IChapterRepository chapters)
    {
        _comics = comics;
        _chapters = chapters;
    }

    // GET /api/Comics?keyword=kiem&genreId=1&status=Ongoing&sort=views&page=1&pageSize=12
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] ComicQueryParams query) =>
        Ok(await _comics.SearchAsync(query));

    // GET /api/Comics/hot?take=10
    [HttpGet("hot")]
    public async Task<IActionResult> Hot([FromQuery] int take = 10)
    {
        var result = await _comics.SearchAsync(new ComicQueryParams
        {
            Sort = "views",
            PageSize = Math.Clamp(take, 1, 50)
        });
        return Ok(result.Items);
    }

    // GET /api/Comics/latest?take=10
    [HttpGet("latest")]
    public async Task<IActionResult> Latest([FromQuery] int take = 10)
    {
        var result = await _comics.SearchAsync(new ComicQueryParams
        {
            Sort = "updated",
            PageSize = Math.Clamp(take, 1, 50)
        });
        return Ok(result.Items);
    }

    // GET /api/Comics/featured?take=5: truyện nổi bật cho banner trang chủ (nhiều lượt xem, kèm mô tả)
    [HttpGet("featured")]
    public async Task<IActionResult> Featured([FromQuery] int take = 5)
    {
        var top = await _comics.SearchAsync(new ComicQueryParams
        {
            Sort = "views",
            PageSize = Math.Clamp(take, 1, 10)
        });

        var result = new List<ComicDetailDto>();
        foreach (var c in top.Items)
        {
            var detail = await _comics.GetDetailAsync(c.Id);
            if (detail is not null) result.Add(detail);
        }
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var comic = await _comics.GetDetailAsync(id);
        return comic is null
            ? NotFound(new { message = "Không tìm thấy truyện" })
            : Ok(comic);
    }

    // GET /api/Comics/1/chapters?desc=true
    [HttpGet("{id:int}/chapters")]
    public async Task<IActionResult> GetChapters(int id, [FromQuery] bool desc = false)
    {
        if (!await _comics.ExistsAsync(id))
            return NotFound(new { message = "Không tìm thấy truyện" });

        return Ok(await _chapters.GetByComicAsync(id, desc));
    }
}