namespace ComicApi.Models;

public class Follow
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}