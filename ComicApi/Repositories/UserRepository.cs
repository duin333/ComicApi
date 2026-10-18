using ComicApi.Data;
using ComicApi.DTOs.Admin;
using ComicApi.DTOs.Common;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByUsernameOrEmailAsync(string key);
    Task<bool> UsernameExistsAsync(string username);
    Task<bool> EmailExistsAsync(string email);
    Task<PagedResult<AdminUserDto>> SearchAsync(string? keyword, int page, int pageSize);
}

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext db) : base(db) { }

    public Task<User?> GetByUsernameOrEmailAsync(string key) =>
        _set.FirstOrDefaultAsync(u => u.Username == key || u.Email == key);

    public Task<bool> UsernameExistsAsync(string username) =>
        _set.AnyAsync(u => u.Username == username);

    public Task<bool> EmailExistsAsync(string email) =>
        _set.AnyAsync(u => u.Email == email);

    public async Task<PagedResult<AdminUserDto>> SearchAsync(string? keyword, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var q = _set.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = keyword.Trim();
            q = q.Where(u => u.Username.Contains(k) || u.Email.Contains(k));
        }

        var total = await q.CountAsync();

        var items = await q.OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                Role = u.Role,
                IsLocked = u.IsLocked,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<AdminUserDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }
}