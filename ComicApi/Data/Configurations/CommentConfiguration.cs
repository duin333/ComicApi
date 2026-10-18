using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> b)
    {
        b.ToTable("comments");
        b.HasKey(c => c.Id);
        b.Property(c => c.Content).IsRequired().HasMaxLength(1000);

        b.HasOne(c => c.User).WithMany(u => u.Comments)
            .HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(c => c.Comic).WithMany(x => x.Comments)
            .HasForeignKey(c => c.ComicId).OnDelete(DeleteBehavior.Cascade);
    }
}