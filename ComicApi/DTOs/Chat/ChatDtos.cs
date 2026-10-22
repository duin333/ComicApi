using System.ComponentModel.DataAnnotations;

namespace ComicApi.DTOs.Chat;

public class ChatRequest
{
    [Required, StringLength(500, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;
}

// Thẻ truyện trả về cho giao diện
public class ChatComicDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public string? Author { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class ChatResponse
{
    public string Reply { get; set; } = string.Empty;
    public List<ChatComicDto> Comics { get; set; } = new();
    public string Intent { get; set; } = string.Empty;   // để kiểm thử, có thể bỏ khi nộp
}

// Thông tin một truyện dùng nội bộ để chọn ứng viên và dựng prompt
public class ChatComicInfo
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Author { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public long ViewCount { get; set; }
    public int ChapterCount { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<string> Genres { get; set; } = new();
}
