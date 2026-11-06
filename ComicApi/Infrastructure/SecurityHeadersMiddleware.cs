using ComicApi.Services;
using Microsoft.Extensions.Options;

namespace ComicApi.Infrastructure;

// Mục "Security" trong appsettings.json
public class SecuritySettings
{
    // Off: không gửi CSP | ReportOnly: chỉ báo vi phạm trong Console, không chặn gì | Enforce: chặn thật
    public string CspMode { get; set; } = "ReportOnly";
}

// Thêm các header bảo mật vào mọi phản hồi. Gắn bằng OnStarting để header vẫn còn
// ngay cả khi bộ bắt lỗi toàn cục xóa phản hồi và viết lại thành lỗi 500
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _csp;
    private readonly string? _cspHeaderName;      // null = tắt CSP

    public SecurityHeadersMiddleware(RequestDelegate next, IOptions<SecuritySettings> options,
        ILogger<SecurityHeadersMiddleware> logger)
    {
        _next = next;
        _csp = BuildCsp();

        var mode = (options.Value.CspMode ?? "").Trim().ToLowerInvariant();
        switch (mode)
        {
            case "off":
                _cspHeaderName = null;
                break;
            case "enforce":
                _cspHeaderName = "Content-Security-Policy";
                break;
            case "reportonly":
                _cspHeaderName = "Content-Security-Policy-Report-Only";
                break;
            default:
                // Gõ sai chế độ thì chọn mức an toàn: chỉ báo, không chặn (chặn nhầm sẽ làm hỏng giao diện)
                logger.LogWarning("Security:CspMode = '{Mode}' không hợp lệ (chỉ nhận Off, ReportOnly, Enforce). Dùng ReportOnly",
                    options.Value.CspMode);
                _cspHeaderName = "Content-Security-Policy-Report-Only";
                break;
        }

        logger.LogInformation("Chính sách bảo mật nội dung (CSP): {Header}", _cspHeaderName ?? "tắt");
    }

    public Task InvokeAsync(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            Apply(ctx);
            return Task.CompletedTask;
        });
        return _next(ctx);
    }

    private void Apply(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        var path = ctx.Request.Path;

        h["X-Content-Type-Options"] = "nosniff";                       // không cho trình duyệt "đoán" loại file (quan trọng với file người dùng tải lên)
        h["X-Frame-Options"] = "DENY";                                 // không cho trang khác nhúng website vào iframe
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";      // sang trang khác chỉ gửi tên miền, không gửi cả đường dẫn
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
        h["Cross-Origin-Opener-Policy"] = "same-origin";

        // Dữ liệu API (có thể là dữ liệu của riêng người dùng) không để trình duyệt hay proxy lưu lại
        if (path.StartsWithSegments("/api") && !h.ContainsKey("Cache-Control"))
            h["Cache-Control"] = "no-store";

        // File người dùng tải lên chỉ được là ảnh: ngay cả khi lọt một file lạ, nó cũng không được chạy như trang web
        if (path.StartsWithSegments("/uploads"))
        {
            h["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
            return;
        }

        // Swagger (chỉ bật khi phát triển) dùng script nội tuyến nên không áp CSP của website
        if (_cspHeaderName is not null && !path.StartsWithSegments("/swagger"))
            h[_cspHeaderName] = _csp;
    }

    private static string BuildCsp()
    {
        // Máy chủ GIF lấy thẳng từ GifUrlValidator, nên thêm máy chủ ở đó là CSP tự theo
        var gifHosts = string.Join(' ', GifUrlValidator.AllowedHostNames.Select(host => "https://" + host));

        return string.Join("; ", new[]
        {
            "default-src 'self'",
            "script-src 'self'",                                       // không script nội tuyến, không CDN
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",   // 'unsafe-inline' vì có style="width:..%"
            "font-src 'self' https://fonts.gstatic.com",
            $"img-src 'self' data: blob: {gifHosts}",                  // data: cho biểu tượng của Bootstrap, blob: cho ảnh xem trước khi tải lên
            "connect-src 'self'",                                      // fetch chỉ được gọi chính API của mình
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'"
        });
    }
}