using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class CommentLikeConfiguration : IEntityTypeConfiguration<CommentLike>
{
    public void Configure(EntityTypeBuilder<CommentLike> b)
    {
        b.ToTable("comment_likes");
        b.HasKey(l => new { l.UserId, l.CommentId });      // mỗi người chỉ thích một bình luận một lần

        b.HasOne(l => l.User).WithMany().HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.Comment).WithMany(c => c.Likes).HasForeignKey(l => l.CommentId).OnDelete(DeleteBehavior.Cascade);
    }
}