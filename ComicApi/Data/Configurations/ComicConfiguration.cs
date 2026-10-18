using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class ComicConfiguration : IEntityTypeConfiguration<Comic>
{
    public void Configure(EntityTypeBuilder<Comic> builder)
    {
        builder.ToTable("comics");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Title).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Author).HasMaxLength(100);
        builder.Property(c => c.CoverUrl).HasMaxLength(500);
        builder.Property(c => c.Status).IsRequired().HasMaxLength(20);
        builder.HasIndex(c => c.Title);   // tăng tốc tìm kiếm theo tên
    }
}