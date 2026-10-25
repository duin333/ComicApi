using System.ComponentModel.DataAnnotations;

namespace ComicApi.DTOs.Social;

public class FollowStatusDto
{
    public bool IsFollowing { get; set; }
    public int FollowCount { get; set; }
}

// Một dòng trong lịch sử đọc: truyện nào, đọc tới chương nào, khi nào
public class HistoryItemDto
{
    public int ComicId { get; set; }
    public string ComicTitle { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public int ChapterId { get; set; }
    public int ChapterNumber { get; set; }
    public string ChapterTitle { get; set; } = string.Empty;
    public DateTime ReadAt { get; set; }
}

public class CommentDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? GifUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Bình luận có thể chỉ có chữ, chỉ có GIF, hoặc cả hai (kiểm tra trong controller)
public class CommentCreateDto
{
    [StringLength(1000)]
    public string? Content { get; set; }

    [StringLength(500)]
    public string? GifUrl { get; set; }
}

public class RatingRequest
{
    [Range(1, 5)]
    public int Stars { get; set; }
}

public class RatingSummaryDto
{
    public double Average { get; set; }                          // 0 nếu chưa có ai đánh giá
    public int Count { get; set; }
    public int[] Distribution { get; set; } = new int[5];        // [số lượt 1 sao, 2 sao, ..., 5 sao]
    public int? MyRating { get; set; }                           // null nếu chưa đăng nhập hoặc chưa đánh giá
}