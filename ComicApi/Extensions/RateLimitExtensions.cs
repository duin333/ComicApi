using System.Net;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace ComicApi.Extensions;

// Đọc từ appsettings.json, mục "RateLimits". Thiếu mục nào thì dùng giá trị mặc định dưới đây
public class RateLimitSettings
{
    public LimitRule Login { get; set; } = new() { PermitLimit = 10, WindowSeconds = 300 };      // 10 lần / 5 phút / IP
    public LimitRule Register { get; set; } = new() { PermitLimit = 10, WindowSeconds = 3600 };  // 10 lần / 1 giờ / IP
    public LimitRule Chat { get; set; } = new() { PermitLimit = 10, WindowSeconds = 60 };        // 10 câu / 1 phút
}

public class LimitRule
{
    public int PermitLimit { get; set; }
    public int WindowSeconds { get; set; }
}

public static class RateLimitExtensions
{
    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        var s = config.GetSection("RateLimits").Get<RateLimitSettings>() ?? new RateLimitSettings();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = (ctx, ct) => WriteRejected(ctx, ct, s);

            // Đăng nhập và đăng ký: chưa biết là ai nên đếm theo địa chỉ IP
            options.AddPolicy("login", ctx => IpWindow(ctx, s.Login));
            options.AddPolicy("register", ctx => IpWindow(ctx, s.Register));

            // Chatbot: đếm theo tài khoản nếu đã đăng nhập, khách thì theo IP (giữ nguyên hành vi Giai đoạn 8)
            options.AddPolicy("chat", ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.User.GetUserId()?.ToString() ?? ClientKey(ctx),
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = Math.Max(1, s.Chat.PermitLimit),
                    Window = TimeSpan.FromSeconds(Math.Max(1, s.Chat.WindowSeconds)),
                    QueueLimit = 0
                }));
        });

        return services;
    }

    // Cửa sổ cố định: đơn giản, dễ giải thích.
    // Nhược điểm nhỏ: ngay tại ranh giới hai cửa sổ có thể dồn tối đa gấp đôi số lần, tổng vẫn bị chặn
    private static RateLimitPartition<string> IpWindow(HttpContext ctx, LimitRule rule) =>
        RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = Math.Max(1, rule.PermitLimit),
            Window = TimeSpan.FromSeconds(Math.Max(1, rule.WindowSeconds)),
            QueueLimit = 0                  // quá giới hạn thì từ chối ngay, không xếp hàng chờ
        });

    // Khóa đếm của một người dùng. Chỉ tin địa chỉ kết nối thật, KHÔNG tin header X-Forwarded-For
    // (kẻ tấn công tự gõ header đó để giả IP). Khi chạy sau nginx/Docker (Giai đoạn 13) mới bật ForwardedHeaders
    public static string ClientKey(HttpContext ctx) => ClientKey(ctx.Connection.RemoteIpAddress);

    public static string ClientKey(IPAddress? ip)
    {
        if (ip is null) return "unknown";
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();      // ::ffff:1.2.3.4 và 1.2.3.4 là cùng một máy

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            // Một nhà mạng thường cấp cả dải /64 cho một khách hàng. Gom theo /64 để không thể
            // né giới hạn bằng cách đổi sang địa chỉ IPv6 khác trong cùng dải
            var bytes = ip.GetAddressBytes();
            Array.Clear(bytes, 8, 8);
            return new IPAddress(bytes) + "/64";
        }

        return ip.ToString();
    }

    private static async ValueTask WriteRejected(OnRejectedContext ctx, CancellationToken ct, RateLimitSettings settings)
    {
        var http = ctx.HttpContext;
        var policy = http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;

        // .NET chỉ cho biết độ dài CẢ cửa sổ chứ không cho biết còn lại bao lâu, nên đây là thời gian chờ TỐI ĐA
        // (có thể được dùng lại sớm hơn). Vì vậy thông báo ghi "tối đa". Thiếu số liệu thì lấy độ dài cửa sổ
        var fallback = policy switch
        {
            "login" => settings.Login.WindowSeconds,
            "register" => settings.Register.WindowSeconds,
            _ => settings.Chat.WindowSeconds
        };
        var retryAfter = ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
            ? Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds))
            : Math.Max(1, fallback);

        http.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("RateLimit")
            .LogWarning("Vượt giới hạn '{Policy}': IP {Ip}, {Method} {Path}, chờ {Seconds}s",
                policy, ClientKey(http), http.Request.Method, http.Request.Path, retryAfter);

        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        http.Response.Headers.RetryAfter = retryAfter.ToString();

        var message = policy switch
        {
            "login" => $"Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau tối đa {HumanWait(retryAfter)}.",
            "register" => $"Bạn đã tạo tài khoản quá nhiều lần. Vui lòng thử lại sau tối đa {HumanWait(retryAfter)}.",
            _ => "Bạn hỏi hơi nhanh, vui lòng chờ một chút rồi hỏi tiếp nhé."
        };

        await http.Response.WriteAsJsonAsync(new { message, retryAfterSeconds = retryAfter }, ct);
    }

    private static string HumanWait(int seconds) =>
        seconds < 90 ? $"{seconds} giây" : $"{(int)Math.Ceiling(seconds / 60.0)} phút";
}