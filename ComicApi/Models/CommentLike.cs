namespace ComicApi.Models;

public class CommentLike
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int CommentId { get; set; }
    public Comment Comment { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}