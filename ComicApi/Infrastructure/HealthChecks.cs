using ComicApi.Data;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ComicApi.Infrastructure;

// Kết nối được tới MySQL không?
public class DatabaseHealthCheck : IHealthCheck
{
    private readonly AppDbContext _db;
    public DatabaseHealthCheck(AppDbContext db) => _db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            return await _db.Database.CanConnectAsync(ct)
                ? HealthCheckResult.Healthy("Kết nối MySQL bình thường")
                : HealthCheckResult.Unhealthy("Không kết nối được MySQL");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Lỗi khi kiểm tra MySQL", ex);
        }
    }
}

// Thư mục wwwroot/uploads có ghi được không? (hay hỏng khi chạy Docker mà quên gắn ổ đĩa)
public class UploadsHealthCheck : IHealthCheck
{
    private readonly IWebHostEnvironment _env;
    public UploadsHealthCheck(IWebHostEnvironment env) => _env = env;

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var dir = Path.Combine(webRoot, "uploads");
            Directory.CreateDirectory(dir);

            var probe = Path.Combine(dir, $".health-{Guid.NewGuid():N}.tmp");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);

            return Task.FromResult(HealthCheckResult.Healthy("Thư mục uploads ghi được"));
        }
        catch (Exception ex)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("Không ghi được vào thư mục uploads", ex));
        }
    }
}

public static class HealthExtensions
{
    public static IServiceCollection AddAppHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready" })
            .AddCheck<UploadsHealthCheck>("uploads", tags: new[] { "ready" });
        return services;
    }

    public static IEndpointRouteBuilder MapAppHealthChecks(this IEndpointRouteBuilder app)
    {
        // "Còn sống không?": chỉ cần ứng dụng trả lời được, không kiểm tra gì thêm (dùng cho Docker, giám sát)
        app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteJson });

        // "Sẵn sàng phục vụ chưa?": kiểm tra MySQL và thư mục uploads; hỏng thì trả 503
        app.MapHealthChecks("/health/ready",
            new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready"), ResponseWriter = WriteJson });

        return app;
    }

    // Chỉ trả tên, trạng thái, mô tả ngắn. KHÔNG trả nội dung exception (có thể lộ chuỗi kết nối, đường dẫn máy chủ)
    private static Task WriteJson(HttpContext ctx, HealthReport report) =>
        ctx.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            totalMs = (int)report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                ms = (int)e.Value.Duration.TotalMilliseconds
            })
        });
}
