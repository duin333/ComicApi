using ComicApi.Models;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComicsController : ControllerBase
{
    private readonly IRepository<Comic> _repo;

    public ComicsController(IRepository<Comic> repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _repo.GetAllAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var comic = await _repo.GetByIdAsync(id);
        return comic is null ? NotFound() : Ok(comic);
    }
}