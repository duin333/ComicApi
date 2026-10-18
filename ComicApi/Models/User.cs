namespace ComicApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;   // KHÔNG lưu mật khẩu thô
    public string Role { get; set; } = Roles.Reader;
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<Comic> UploadedComics { get; set; } = new();
    public List<Follow> Follows { get; set; } = new();
    public List<ReadingHistory> Histories { get; set; } = new();
    public List<Comment> Comments { get; set; } = new();
}