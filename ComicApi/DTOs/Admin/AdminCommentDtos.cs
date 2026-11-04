using System.ComponentModel.DataAnnotations;

namespace ComicApi.DTOs.Admin;

public class AdminCommentDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public bool UserLocked { get; set; }
    public int ComicId { get; set; }
    public string ComicTitle { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? GifUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? ParentId { get; set; }
    public string? ParentUsername { get; set; }
    public string? ParentContent { get; set; }
    public int LikeCount { get; set; }
    public int ReplyCount { get; set; }
}

// Các điều kiện lọc gửi lên từ trang quản lý bình luận
public class AdminCommentQuery
{
    public string? Keyword { get; set; }     // tìm trong nội dung, tên người dùng, tên truyện
    public int? ComicId { get; set; }
    public int? UserId { get; set; }
    public bool? HasGif { get; set; }
    public bool? Locked { get; set; }        // chỉ bình luận của tài khoản đang bị khóa
    public string? Sort { get; set; }        // newest (mặc định) | oldest
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public bool? OnlyReplies { get; set; }   // chỉ hiện phản hồi
}

public class BulkDeleteRequest
{
    [Required, MinLength(1), MaxLength(200)]
    public List<int> Ids { get; set; } = new();
}