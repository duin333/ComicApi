using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class ComicGenreConfiguration : IEntityTypeConfiguration<ComicGenre>
{
    public void Configure(EntityTypeBuilder<ComicGenre> b)
    {
        b.ToTable("comic_genres");
        b.HasKey(x => new { x.ComicId, x.GenreId });   // khóa chính gồm 2 cột

        b.HasOne(x => x.Comic).WithMany(c => c.ComicGenres)
            .HasForeignKey(x => x.ComicId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Genre).WithMany(g => g.ComicGenres)
            .HasForeignKey(x => x.GenreId).OnDelete(DeleteBehavior.Cascade);
    }
}