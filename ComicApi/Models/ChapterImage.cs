namespace ComicApi.Models;

public class ChapterImage
{
    public int Id { get; set; }
    public int ChapterId { get; set; }
    public Chapter Chapter { get; set; } = null!;

    public string ImageUrl { get; set; } = string.Empty;
    public int SortOrder { get; set; }              // thứ tự trang trong chương
}