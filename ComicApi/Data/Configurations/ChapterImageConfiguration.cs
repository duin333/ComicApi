using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class ChapterImageConfiguration : IEntityTypeConfiguration<ChapterImage>
{
    public void Configure(EntityTypeBuilder<ChapterImage> b)
    {
        b.ToTable("chapter_images");
        b.HasKey(i => i.Id);
        b.Property(i => i.ImageUrl).IsRequired().HasMaxLength(500);

        b.HasOne(i => i.Chapter).WithMany(c => c.Images)
            .HasForeignKey(i => i.ChapterId).OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(i => new { i.ChapterId, i.SortOrder });
    }
}