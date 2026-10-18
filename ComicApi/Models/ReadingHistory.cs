namespace ComicApi.Models;

public class ReadingHistory
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public int ChapterId { get; set; }
    public Chapter Chapter { get; set; } = null!;

    public DateTime ReadAt { get; set; } = DateTime.UtcNow;
}