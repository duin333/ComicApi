using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Comic> Comics => Set<Comic>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Genre> Genres => Set<Genre>();
    public DbSet<ComicGenre> ComicGenres => Set<ComicGenre>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<ChapterImage> ChapterImages => Set<ChapterImage>();
    public DbSet<Follow> Follows => Set<Follow>();
    public DbSet<ReadingHistory> ReadingHistories => Set<ReadingHistory>();
    public DbSet<Comment> Comments => Set<Comment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}