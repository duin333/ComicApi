namespace ComicApi.Models;

public class Rating
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public int Stars { get; set; }                       // từ 1 đến 5
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}