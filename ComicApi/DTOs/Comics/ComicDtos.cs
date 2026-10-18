namespace ComicApi.DTOs.Comics;

public class GenreDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// Dùng cho danh sách (thẻ truyện ở trang chủ)
public class ComicListItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Author { get; set; }
    public string? CoverUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public long ViewCount { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<string> Genres { get; set; } = new();
    public int ChapterCount { get; set; }
    public int? LatestChapterNumber { get; set; }
}

// Dùng cho trang chi tiết truyện
public class ComicDetailDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Author { get; set; }
    public string? CoverUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public long ViewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<GenreDto> Genres { get; set; } = new();
    public int ChapterCount { get; set; }
    public int FollowCount { get; set; }
    public int CommentCount { get; set; }
}