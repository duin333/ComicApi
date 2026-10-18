namespace ComicApi.DTOs.Comics;

public class ComicQueryParams
{
    public string? Keyword { get; set; }
    public int? GenreId { get; set; }
    public string? Status { get; set; }     // Ongoing | Completed
    public string? Sort { get; set; }       // updated (mặc định) | newest | views | title
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
}