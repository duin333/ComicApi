using System.Security.Claims;
using ComicApi.DTOs.Auth;
using ComicApi.Models;
using ComicApi.Repositories;
using ComicApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtService _jwt;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IUserRepository users, IPasswordHasher hasher, IJwtService jwt, ILogger<AuthController> logger)
    {
        _users = users;
        _hasher = hasher;
        _jwt = jwt;
        _logger = logger;
    }

    [HttpPost("register")]
    [EnableRateLimiting("register")]
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
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var user = await _users.GetByUsernameOrEmailAsync(dto.UsernameOrEmail.Trim());

        // Báo chung một câu để kẻ xấu không dò được tài khoản nào tồn tại
        if (user is null || !_hasher.Verify(dto.Password, user.PasswordHash))
        {
            // Chỉ ghi tên khi tài khoản có thật. Người dùng hay gõ nhầm mật khẩu vào ô tên đăng nhập,
            // ghi lại sẽ vô tình để mật khẩu nằm trong file log
            _logger.LogWarning("Đăng nhập sai: {Who} từ IP {Ip}",
                user is null ? "(tên không tồn tại)" : user.Username, HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new { message = "Sai tên đăng nhập hoặc mật khẩu" });
        }

        if (user.IsLocked)
        {
            _logger.LogWarning("Tài khoản bị khóa cố đăng nhập: {Username} từ IP {Ip}",
                user.Username, HttpContext.Connection.RemoteIpAddress);
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "Tài khoản đã bị khóa" });
        }

        _logger.LogInformation("Đăng nhập thành công: {Username}", user.Username);
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