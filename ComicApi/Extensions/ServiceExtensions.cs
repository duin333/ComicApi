using ComicApi.Data;
using Microsoft.EntityFrameworkCore;

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
}