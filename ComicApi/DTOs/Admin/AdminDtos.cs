using System.ComponentModel.DataAnnotations;
using ComicApi.DTOs.Comics;

namespace ComicApi.DTOs.Admin;

// Dùng cho cả tạo và sửa truyện
public class ComicSaveDto
{
    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(4000)]
    public string? Description { get; set; }

    [StringLength(100)]
    public string? Author { get; set; }

    [StringLength(500)]
    public string? CoverUrl { get; set; }

    [RegularExpression("^(Ongoing|Completed)$", ErrorMessage = "Status chỉ nhận Ongoing hoặc Completed")]
    public string Status { get; set; } = "Ongoing";

    public List<int> GenreIds { get; set; } = new();
}

public class GenreSaveDto
{
    [Required, StringLength(50)]
    public string Name { get; set; } = string.Empty;
}

// Dùng cho cả tạo và sửa chương
public class ChapterSaveDto
{
    [Range(1, 100000)]
    public int Number { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    public bool IsHidden { get; set; }

    // Khi tạo: bắt buộc có ít nhất 1 ảnh.
    // Khi sửa: để null nghĩa là giữ nguyên ảnh cũ, có giá trị nghĩa là thay toàn bộ ảnh.
    public List<string>? ImageUrls { get; set; }
}

public class AdminChapterListItemDto
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public long ViewCount { get; set; }
    public int ImageCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminChapterDetailDto
{
    public int Id { get; set; }
    public int ComicId { get; set; }
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public long ViewCount { get; set; }
    public List<ChapterImageDto> Images { get; set; } = new();
}

public class AdminUserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChangeRoleDto
{
    [Required, RegularExpression("^(Admin|Reader)$", ErrorMessage = "Role chỉ nhận Admin hoặc Reader")]
    public string Role { get; set; } = string.Empty;
}

public class LockUserDto
{
    public bool IsLocked { get; set; }
}