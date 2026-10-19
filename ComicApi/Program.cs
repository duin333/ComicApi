using ComicApi.Data;
using ComicApi.Extensions;
using ComicApi.Repositories;
using ComicApi.Services;

var builder = WebApplication.CreateBuilder(args);

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

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();    
app.UseAuthorization();

app.MapControllers();
app.Run();