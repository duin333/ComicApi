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
    public DateTime CreatedAt { get; set; }
}

public class CommentCreateDto
{
    [Required, StringLength(1000, MinimumLength = 1)]
    public string Content { get; set; } = string.Empty;
}