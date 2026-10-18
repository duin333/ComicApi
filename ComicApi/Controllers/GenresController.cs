using ComicApi.DTOs.Comics;
using ComicApi.Models;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenresController : ControllerBase
{
    private readonly IRepository<Genre> _genres;

    public GenresController(IRepository<Genre> genres) => _genres = genres;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _genres.GetAllAsync();
        return Ok(list.OrderBy(g => g.Name)
                      .Select(g => new GenreDto { Id = g.Id, Name = g.Name }));
    }
}