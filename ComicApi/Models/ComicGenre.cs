namespace ComicApi.Models;

public class ComicGenre
{
    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public int GenreId { get; set; }
    public Genre Genre { get; set; } = null!;
}