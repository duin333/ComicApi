using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class FollowConfiguration : IEntityTypeConfiguration<Follow>
{
    public void Configure(EntityTypeBuilder<Follow> b)
    {
        b.ToTable("follows");
        b.HasKey(f => new { f.UserId, f.ComicId });   // 1 người chỉ theo dõi 1 truyện 1 lần

        b.HasOne(f => f.User).WithMany(u => u.Follows)
            .HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(f => f.Comic).WithMany(c => c.Follows)
            .HasForeignKey(f => f.ComicId).OnDelete(DeleteBehavior.Cascade);
    }
}