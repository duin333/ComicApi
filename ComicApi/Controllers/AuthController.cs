using System.Security.Claims;
using ComicApi.DTOs.Auth;
using ComicApi.Models;
using ComicApi.Repositories;
using ComicApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;

    public AuthController(IUserRepository users, IPasswordHasher hasher, IJwtService jwt)
    {
        _users = users;
        _hasher = hasher;
        _jwt = jwt;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        if (await _users.UsernameExistsAsync(dto.Username))
            return Conflict(new { message = "Tên đăng nhập đã tồn tại" });

        if (await _users.EmailExistsAsync(dto.Email))
            return Conflict(new { message = "Email đã được sử dụng" });

        var user = new User
        {
            Username = dto.Username.Trim(),
            Email = dto.Email.Trim(),
            PasswordHash = _hasher.Hash(dto.Password),
            Role = Roles.Reader        // đăng ký công khai luôn là Reader, không cho tự chọn Admin
        };

        await _users.AddAsync(user);
        await _users.SaveAsync();

        return Ok(BuildResponse(user));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _users.GetByUsernameOrEmailAsync(dto.UsernameOrEmail.Trim());

        // Báo chung một câu để kẻ xấu không dò được tài khoản nào tồn tại
        if (user is null || !_hasher.Verify(dto.Password, user.PasswordHash))
            return Unauthorized(new { message = "Sai tên đăng nhập hoặc mật khẩu" });

        if (user.IsLocked)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Tài khoản đã bị khóa" });

        return Ok(BuildResponse(user));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var idText = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idText, out var id)) return Unauthorized();

        var user = await _users.GetByIdAsync(id);
        if (user is null || user.IsLocked) return Unauthorized();

        return Ok(ToDto(user));
    }

    private AuthResponseDto BuildResponse(User user)
    {
        var (token, expiresAt) = _jwt.CreateToken(user);
        return new AuthResponseDto { Token = token, ExpiresAt = expiresAt, User = ToDto(user) };
    }

    private static UserDto ToDto(User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        Email = u.Email,
        Role = u.Role
    };
}