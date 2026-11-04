using System.Text;
using ComicApi.Data;
using ComicApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;

namespace ComicApi.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration config)
    {
        var cs = config.GetConnectionString("Default");
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseMySql(cs, ServerVersion.AutoDetect(cs)));
        return services;
    }

    public static IServiceCollection AddJwtAuth(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<JwtSettings>(config.GetSection("Jwt"));
        var jwt = config.GetSection("Jwt").Get<JwtSettings>()!;

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero      // hết hạn là hết hạn, không du di 5 phút
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = CheckAccountStillValid,   // 11.1
                    OnChallenge = WriteChallengeJson             // 11.1
                };
            });

        services.AddAuthorization();
        return services;
    }

    // ---------- 11.1: khóa tài khoản có hiệu lực ngay ----------
    private const string RejectCodeKey = "auth.reject.code";
    private const string RejectMessageKey = "auth.reject.message";

    // Chữ ký và hạn dùng của token đã hợp lệ. Giờ hỏi database xem tài khoản còn được dùng không
    private static async Task CheckAccountStillValid(TokenValidatedContext ctx)
    {
        var idText = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(idText, out var userId))
        {
            Reject(ctx, "invalid_token", "Phiên đăng nhập không hợp lệ");
            return;
        }

        var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var user = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.IsLocked, u.Role })          // chỉ lấy hai cột cần
            .FirstOrDefaultAsync(ctx.HttpContext.RequestAborted);

        if (user is null)
            Reject(ctx, "account_missing", "Tài khoản không còn tồn tại");
        else if (user.IsLocked)
            Reject(ctx, "account_locked", "Tài khoản đã bị khóa");
        else if (user.Role != ctx.Principal!.FindFirstValue(ClaimTypes.Role))
            Reject(ctx, "role_changed", "Quyền của tài khoản đã thay đổi, vui lòng đăng nhập lại");
    }

    private static void Reject(TokenValidatedContext ctx, string code, string message)
    {
        ctx.HttpContext.Items[RejectCodeKey] = code;           // để OnChallenge biết lý do
        ctx.HttpContext.Items[RejectMessageKey] = message;
        ctx.Fail(message);
    }

    // Trả JSON {message, code} thay vì 401 trống, để trình duyệt hiện đúng lý do
    private static async Task WriteChallengeJson(JwtBearerChallengeContext ctx)
    {
        if (!ctx.HttpContext.Items.TryGetValue(RejectCodeKey, out var codeObj) || codeObj is not string code)
            return;                                            // lỗi khác (token hết hạn...): giữ cách mặc định

        ctx.HandleResponse();                                  // mình tự trả lời, bỏ cách mặc định
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new
        {
            message = ctx.HttpContext.Items.TryGetValue(RejectMessageKey, out var m) && m is string s
                ? s : "Phiên đăng nhập không hợp lệ",
            code
        });
    }

    public static IServiceCollection AddSwaggerWithJwt(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Dán token vào đây (không cần gõ chữ Bearer)"
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });
        return services;
    }
}