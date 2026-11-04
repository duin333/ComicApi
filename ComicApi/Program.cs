using ComicApi.Data;
using ComicApi.Extensions;
using ComicApi.Repositories;
using ComicApi.Services;
using ComicApi.Services.Chat;
using Microsoft.EntityFrameworkCore;
using ComicApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.AddFileLogging(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerWithJwt();          // thay cho AddSwaggerGen()

builder.Services.AddDatabase(builder.Configuration);
builder.Services.AddJwtAuth(builder.Configuration);

builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<IJwtService, JwtService>();

builder.Services.AddScoped<IComicRepository, ComicRepository>();
builder.Services.AddScoped<IChapterRepository, ChapterRepository>();

builder.Services.AddSingleton<IFileStorage, FileStorage>();

builder.Services.AddScoped<IFollowRepository, FollowRepository>();
builder.Services.AddScoped<IReadingHistoryRepository, ReadingHistoryRepository>();
builder.Services.AddScoped<ICommentRepository, CommentRepository>();

builder.Services.AddScoped<IRatingRepository, RatingRepository>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddAppHealthChecks();

builder.Services.Configure<OpenRouterSettings>(builder.Configuration.GetSection("OpenRouter"));
builder.Services.AddHttpClient<ILlmClient, OpenRouterClient>(client =>
{
    client.BaseAddress = new Uri("https://openrouter.ai/api/v1/");
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddScoped<IChatRepository, ChatRepository>();
builder.Services.AddScoped<IChatService, ChatService>();

builder.Services.AddAppRateLimiting(builder.Configuration);



// Nén HTML, JS, CSS, JSON để tải nhanh hơn
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

app.UseMiddleware<RequestLoggingMiddleware>();    // ngoài cùng, để thấy cả lỗi 500
app.UseExceptionHandler();
app.UseResponseCompression();
app.UseResponseCompression();

// Địa chỉ không tồn tại (không phải API hay file) thì hiện trang 404 của website
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    var path = context.HttpContext.Request.Path;

    var isApi = path.StartsWithSegments("/api") || path.StartsWithSegments("/swagger");
    var isFile = Path.HasExtension(path.Value ?? string.Empty);

    if (response.StatusCode == StatusCodes.Status404NotFound && !isApi && !isFile)
    {
        response.ContentType = "text/html; charset=utf-8";
        await response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "404.html"));
    }
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Ảnh bìa, ảnh thể loại, GIF hiếm khi đổi nên cho trình duyệt nhớ 7 ngày.
        // Chỉ áp dụng khi chạy thật, còn lúc đang phát triển thì không để đỡ bị kẹt ảnh cũ.
        var path = ctx.Context.Request.Path;
        if (!app.Environment.IsDevelopment() &&
            (path.StartsWithSegments("/uploads") || path.StartsWithSegments("/img")))
        {
            ctx.Context.Response.Headers.CacheControl = "public,max-age=604800";
        }
    }
});

app.UseAuthentication();     // đứng trước UseAuthorization
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapAppHealthChecks();
app.Run();