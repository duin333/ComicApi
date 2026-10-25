using ComicApi.Data;
using ComicApi.DTOs.Social;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IRatingRepository : IRepository<Rating>
{
    Task<RatingSummaryDto> GetSummaryAsync(int comicId, int? userId);
    Task SetAsync(int userId, int comicId, int stars);
    Task<int> RemoveAsync(int userId, int comicId);
}

public class RatingRepository : Repository<Rating>, IRatingRepository
{
    public RatingRepository(AppDbContext db) : base(db) { }

    public async Task<RatingSummaryDto> GetSummaryAsync(int comicId, int? userId)
    {
        // Đếm số lượt theo từng mức sao ngay trong database
        var groups = await _set.AsNoTracking()
            .Where(r => r.ComicId == comicId)
            .GroupBy(r => r.Stars)
            .Select(g => new { Stars = g.Key, Count = g.Count() })
            .ToListAsync();

        var distribution = new int[5];
        foreach (var g in groups)
            if (g.Stars is >= 1 and <= 5) distribution[g.Stars - 1] = g.Count;

        var count = distribution.Sum();
        var total = Enumerable.Range(0, 5).Sum(i => (i + 1) * distribution[i]);

        int? mine = null;
        if (userId is not null)
        {
            mine = await _set.AsNoTracking()
                .Where(r => r.ComicId == comicId && r.UserId == userId)
                .Select(r => (int?)r.Stars)
                .FirstOrDefaultAsync();
        }

        return new RatingSummaryDto
        {
            Average = count == 0 ? 0 : Math.Round(total / (double)count, 1),
            Count = count,
            Distribution = distribution,
            MyRating = mine
        };
    }

    // Chấm lần đầu thì thêm mới, chấm lại thì cập nhật số sao
    public async Task SetAsync(int userId, int comicId, int stars)
    {
        var now = DateTime.UtcNow;

        var updated = await UpdateRowAsync(userId, comicId, stars, now);
        if (updated > 0) return;

        try
        {
            _set.Add(new Rating { UserId = userId, ComicId = comicId, Stars = stars, CreatedAt = now, UpdatedAt = now });
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Hai yêu cầu cùng lúc tạo dòng đầu tiên: dòng đã có, chỉ cần cập nhật lại
            _db.ChangeTracker.Clear();
            await UpdateRowAsync(userId, comicId, stars, now);
        }
    }

    private Task<int> UpdateRowAsync(int userId, int comicId, int stars, DateTime now) =>
        _set.Where(r => r.UserId == userId && r.ComicId == comicId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Stars, stars)
                .SetProperty(r => r.UpdatedAt, now));

    public Task<int> RemoveAsync(int userId, int comicId) =>
        _set.Where(r => r.UserId == userId && r.ComicId == comicId).ExecuteDeleteAsync();
}