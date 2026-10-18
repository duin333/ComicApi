using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class GenreConfiguration : IEntityTypeConfiguration<Genre>
{
    public void Configure(EntityTypeBuilder<Genre> b)
    {
        b.ToTable("genres");
        b.HasKey(g => g.Id);
        b.Property(g => g.Name).IsRequired().HasMaxLength(50);
        b.HasIndex(g => g.Name).IsUnique();
    }
}