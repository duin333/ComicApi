namespace ComicApi.Models;

public class Comment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? GifUrl { get; set; }
    // 10.13: phản hồi (hai cấp: bình luận gốc có ParentId = null)
    public int? ParentId { get; set; }
    public Comment? Parent { get; set; }
    public List<Comment> Replies { get; set; } = new();

    // Người được nhắc tên khi trả lời một phản hồi (hiện "@tên")
    public int? ReplyToUserId { get; set; }
    public User? ReplyToUser { get; set; }

    public List<CommentLike> Likes { get; set; } = new();
}