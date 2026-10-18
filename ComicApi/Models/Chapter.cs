namespace ComicApi.Models;

public class Chapter
{
    public int Id { get; set; }
    public int ComicId { get; set; }
    public Comic Comic { get; set; } = null!;

    public int Number { get; set; }                 // số thứ tự chương: 1, 2, 3...
    public string Title { get; set; } = string.Empty;
    public long ViewCount { get; set; }
    public bool IsHidden { get; set; }              // admin ẩn chương
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<ChapterImage> Images { get; set; } = new();
}