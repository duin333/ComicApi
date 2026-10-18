using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Comic> Comics => Set<Comic>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Tự quét và áp dụng mọi file cấu hình trong project
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}