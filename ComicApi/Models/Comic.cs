namespace ComicApi.Models;

public class Comic
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Author { get; set; }
    public string? CoverUrl { get; set; }
    public string Status { get; set; } = "Ongoing";   // Ongoing | Completed
    public long ViewCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}