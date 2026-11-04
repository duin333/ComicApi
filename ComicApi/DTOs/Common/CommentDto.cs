using ComicApi.DTOs.Common;   

public class CommentDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? GifUrl { get; set; }
    public DateTime CreatedAt { get; set; }

    // 10.13
    public int? ParentId { get; set; }
    public string? ReplyToUsername { get; set; }
    public int LikeCount { get; set; }
    public bool LikedByMe { get; set; }
    public int ReplyCount { get; set; }
    public List<CommentDto> Replies { get; set; } = new();     // vài phản hồi đầu, chỉ có ở bình luận gốc
}

// Trang bình luận gốc, kèm tổng số bình luận tính cả phản hồi
public class CommentPageDto : PagedResult<CommentDto>
{
    public int TotalComments { get; set; }
}