using Microsoft.AspNetCore.Diagnostics;

namespace ComicApi.Infrastructure;

// Mọi lỗi không ai bắt sẽ rơi vào đây: ghi log đầy đủ, còn người dùng chỉ nhận một câu chung kèm mã tham chiếu.
// Không bao giờ trả chi tiết lỗi (đường dẫn file, câu SQL, chuỗi kết nối...) ra ngoài khi chạy thật
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        // Người dùng đóng tab hoặc hủy yêu cầu giữa chừng: không phải lỗi của hệ thống
        if (ex is OperationCanceledException && ctx.RequestAborted.IsCancellationRequested)
        {
            ctx.Response.StatusCode = 499;
            return true;
        }

        var (status, message) = ex switch
        {
            BadHttpRequestException bad when bad.StatusCode == StatusCodes.Status413PayloadTooLarge
                => (bad.StatusCode, "Dữ liệu gửi lên quá lớn."),
            BadHttpRequestException bad
                => (bad.StatusCode, "Yêu cầu không hợp lệ."),
            _ => (StatusCodes.Status500InternalServerError, "Máy chủ đang gặp sự cố, vui lòng thử lại sau.")
        };

        if (status >= 500)
            _logger.LogError(ex, "Lỗi chưa xử lý [{TraceId}] {Method} {Path}",
                ctx.TraceIdentifier, ctx.Request.Method, ctx.Request.Path);
        else
            _logger.LogWarning("Yêu cầu bị từ chối [{TraceId}] {Method} {Path}: {Reason}",
                ctx.TraceIdentifier, ctx.Request.Method, ctx.Request.Path, ex.Message);

        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new
        {
            message,
            traceId = ctx.TraceIdentifier,                         // người dùng gửi mã này, mình tra trong log
            detail = _env.IsDevelopment() ? ex.Message : null      // chi tiết chỉ hiện khi đang phát triển
        }, ct);

        return true;
    }
}
