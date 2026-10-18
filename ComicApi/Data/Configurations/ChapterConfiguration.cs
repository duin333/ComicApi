using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> b)
    {
        b.ToTable("chapters");
        b.HasKey(c => c.Id);
        b.Property(c => c.Title).IsRequired().HasMaxLength(200);

        b.HasOne(c => c.Comic).WithMany(x => x.Chapters)
            .HasForeignKey(c => c.ComicId).OnDelete(DeleteBehavior.Cascade);

        // Trong 1 truyện, số chương không được trùng
        b.HasIndex(c => new { c.ComicId, c.Number }).IsUnique();
    }
}