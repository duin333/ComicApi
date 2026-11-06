namespace ComicApi.Services;

public static class GifUrlValidator
{
    // Muốn cho phép nhà cung cấp GIF khác thì thêm tên miền vào danh sách này
    private static readonly HashSet<string> AllowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "media.giphy.com", "media0.giphy.com", "media1.giphy.com", "media2.giphy.com",
        "media3.giphy.com", "media4.giphy.com", "i.giphy.com",
        "media.tenor.com", "c.tenor.com"
    };
    public static IReadOnlyCollection<string> AllowedHostNames => AllowedHosts;

    public static bool IsAllowed(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || url.Length > 500) return false;
        if (url.Contains('\\') || url.Contains(' ')) return false;

        // GIF trong thư viện của chính website
        if (url.StartsWith("/uploads/gifs/", StringComparison.Ordinal))
            return !url.Contains("..") && IsImagePath(url);

        // GIF từ bên ngoài: bắt buộc https, tên miền nằm trong danh sách cho phép
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;

        return uri.Scheme == Uri.UriSchemeHttps
            && AllowedHosts.Contains(uri.Host)
            && IsImagePath(uri.AbsolutePath);
    }

    private static bool IsImagePath(string path)
    {
        var p = path.Split('?', '#')[0].ToLowerInvariant();
        return p.EndsWith(".gif") || p.EndsWith(".webp");
    }
}