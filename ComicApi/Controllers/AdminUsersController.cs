using ComicApi.DTOs.Admin;
using ComicApi.Extensions;
using ComicApi.Models;
using ComicApi.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = Roles.Admin)]
public class AdminUsersController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(IUserRepository users, ILogger<AdminUsersController> logger)
    {
        _users = users;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? keyword,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20) =>
        Ok(await _users.SearchAsync(keyword, page, pageSize));

    [HttpPut("{id:int}/role")]
    public async Task<IActionResult> ChangeRole(int id, ChangeRoleDto dto)
    {
        if (id == User.GetUserId())
            return BadRequest(new { message = "Bạn không thể tự đổi quyền của chính mình" });

        var user = await _users.GetByIdAsync(id);
        var oldRole = user.Role;
        if (user is null) return NotFound(new { message = "Không tìm thấy người dùng" });

        user.Role = dto.Role;
        await _users.SaveAsync();
        _logger.LogInformation("Admin {AdminId} đổi quyền người dùng {UserId} ({Username}) từ {Old} sang {New}",
            User.GetUserId(), id, user.Username, oldRole, dto.Role);

        return NoContent();
    }

    [HttpPut("{id:int}/lock")]
    public async Task<IActionResult> SetLock(int id, LockUserDto dto)
    {
        if (id == User.GetUserId())
            return BadRequest(new { message = "Admin không thể tự khóa chính mình" });

        var user = await _users.GetByIdAsync(id);
        if (user is null) return NotFound(new { message = "Không tìm thấy người dùng" });

        user.IsLocked = dto.IsLocked;
        await _users.SaveAsync();
        _logger.LogInformation("Admin {AdminId} {Action} tài khoản {UserId} ({Username})",
            User.GetUserId(), dto.IsLocked ? "khóa" : "mở khóa", id, user.Username);
        return NoContent();
    }
}