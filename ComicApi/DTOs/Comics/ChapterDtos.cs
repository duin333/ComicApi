namespace ComicApi.DTOs.Comics;

public class ChapterListItemDto
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public long ViewCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChapterImageDto
{
    public int Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class ChapterDetailDto
{
    public int Id { get; set; }
    public int ComicId { get; set; }
    public string ComicTitle { get; set; } = string.Empty;
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public long ViewCount { get; set; }
    public List<ChapterImageDto> Images { get; set; } = new();
    public int? PrevChapterId { get; set; }    // null nếu là chương đầu
    public int? NextChapterId { get; set; }    // null nếu là chương cuối
}