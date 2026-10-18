using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class ReadingHistoryConfiguration : IEntityTypeConfiguration<ReadingHistory>
{
    public void Configure(EntityTypeBuilder<ReadingHistory> b)
    {
        b.ToTable("reading_histories");
        b.HasKey(h => new { h.UserId, h.ComicId });

        b.HasOne(h => h.User).WithMany(u => u.Histories)
            .HasForeignKey(h => h.UserId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(h => h.Comic).WithMany()
            .HasForeignKey(h => h.ComicId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(h => h.Chapter).WithMany()
            .HasForeignKey(h => h.ChapterId).OnDelete(DeleteBehavior.Cascade);
    }
}