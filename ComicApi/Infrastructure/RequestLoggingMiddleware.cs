using System.Diagnostics;
using ComicApi.Extensions;

namespace ComicApi.Infrastructure;

// Gắn một mã ngắn cho mỗi yêu cầu (trả về trong header X-Trace-Id) và ghi một dòng log cho mỗi lệnh gọi /api:
// phương thức, đường dẫn, mã trạng thái, thời gian, người dùng, IP.
// Chỉ ghi đường dẫn, KHÔNG ghi query string, nội dung gửi lên, token hay mật khẩu
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        var code = Guid.NewGuid().ToString("N")[..8];
        ctx.TraceIdentifier = code;
        ctx.Response.OnStarting(() =>
        {
            ctx.Response.Headers["X-Trace-Id"] = code;
            return Task.CompletedTask;
        });

        // Ảnh, CSS, JS, trang HTML... không ghi cho đỡ ồn; chỉ ghi các lệnh gọi API
        if (!ctx.Request.Path.StartsWithSegments("/api"))
        {
            await _next(ctx);
            return;
        }

        var sw = Stopwatch.StartNew();
        var crashed = false;
        try
        {
            await _next(ctx);
        }
        catch
        {
            crashed = true;
            throw;
        }
        finally
        {
            sw.Stop();
            var status = crashed ? StatusCodes.Status500InternalServerError : ctx.Response.StatusCode;
            var level = status >= 500 ? LogLevel.Error
                      : status >= 400 ? LogLevel.Warning
                      : LogLevel.Information;

            _logger.Log(level, "{Method} {Path} -> {Status} trong {Ms}ms | user {UserId} | IP {Ip} | mã {TraceId}",
                ctx.Request.Method, ctx.Request.Path.Value, status, sw.ElapsedMilliseconds,
                ctx.User.GetUserId()?.ToString() ?? "-", ctx.Connection.RemoteIpAddress, code);
        }
    }
}
