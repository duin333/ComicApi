namespace ComicApi.Services;

public class InvalidUploadException : Exception
{
    public InvalidUploadException(string message) : base(message) { }
}

public interface IFileStorage
{
    Task<string> SaveImageAsync(IFormFile file, string folder, long maxBytes);
    void DeleteLocal(string? url);
    bool IsAllowedUrl(string? url);
}

public class FileStorage : IFileStorage
{
    private const string UrlPrefix = "/uploads/";

    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif" };

    private readonly string _root;

    public FileStorage(IWebHostEnvironment env)
    {
        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        _root = Path.GetFullPath(Path.Combine(webRoot, "uploads"));
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveImageAsync(IFormFile file, string folder, long maxBytes)
    {
        if (file.Length == 0)
            throw new InvalidUploadException($"File '{file.FileName}' bị rỗng");

        if (file.Length > maxBytes)
            throw new InvalidUploadException(
                $"File '{file.FileName}' vượt quá {maxBytes / 1024 / 1024} MB");

        var ext = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidUploadException(
                $"File '{file.FileName}' không hợp lệ, chỉ nhận jpg, jpeg, png, webp, gif");

        // Đọc 12 byte đầu để chắc chắn đây đúng là ảnh (chống đổi đuôi .exe thành .jpg)
        var header = new byte[12];
        await using (var check = file.OpenReadStream())
        {
            var read = await check.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
            if (read < header.Length || !LooksLikeImage(header))
                throw new InvalidUploadException($"File '{file.FileName}' không phải ảnh hợp lệ");
        }

        var dir = Path.Combine(_root, folder);
        Directory.CreateDirectory(dir);

        // Đặt tên ngẫu nhiên để không trùng tên và không dùng tên file do người dùng gửi
        var name = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";

        await using (var src = file.OpenReadStream())
        await using (var dst = File.Create(Path.Combine(dir, name)))
        {
            await src.CopyToAsync(dst);
        }

        return $"{UrlPrefix}{folder}/{name}";
    }

    public void DeleteLocal(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(UrlPrefix)) return;

        var relative = url.Substring(UrlPrefix.Length).Replace('/', Path.DirectorySeparatorChar);
        var full = Path.GetFullPath(Path.Combine(_root, relative));

        // Chặn kiểu đường dẫn "../" để không xóa nhầm file ngoài thư mục uploads
        if (!full.StartsWith(_root + Path.DirectorySeparatorChar)) return;

        try { if (File.Exists(full)) File.Delete(full); }
        catch { /* xóa file thất bại thì bỏ qua, không làm hỏng thao tác chính */ }
    }

    public bool IsAllowedUrl(string? url) =>
        !string.IsNullOrWhiteSpace(url)
        && url.Length <= 500
        && ((url.StartsWith(UrlPrefix) && !url.Contains(".."))
            || url.StartsWith("https://")
            || url.StartsWith("http://"));

    private static bool LooksLikeImage(byte[] h) =>
        (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) ||                                  // JPEG
        (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) ||                  // PNG
        (h[0] == 0x47 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x38) ||                  // GIF
        (h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 &&
         h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50);                  // WEBP
}