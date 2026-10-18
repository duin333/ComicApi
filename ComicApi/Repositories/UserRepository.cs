using ComicApi.Data;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByUsernameOrEmailAsync(string key);
    Task<bool> UsernameExistsAsync(string username);
    Task<bool> EmailExistsAsync(string email);
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
}