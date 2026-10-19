using ComicApi.Data;
using ComicApi.DTOs.Common;
using ComicApi.DTOs.Social;
using ComicApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ComicApi.Repositories;

public interface IReadingHistoryRepository : IRepository<ReadingHistory>
{
    Task<PagedResult<HistoryItemDto>> GetByUserAsync(int userId, int page, int pageSize);
    Task<HistoryItemDto?> GetForComicAsync(int userId, int comicId);
    Task<bool> SaveProgressAsync(int userId, int chapterId);
    Task<int> RemoveForComicAsync(int userId, int comicId);
    Task<int> ClearAsync(int userId);
}

public class ReadingHistoryRepository : Repository<ReadingHistory>, IReadingHistoryRepository
{
    public ReadingHistoryRepository(AppDbContext db) : base(db) { }

    // Lịch sử của 1 người, bỏ những chương đã bị ẩn (người đọc không mở được nữa), mới nhất trước
    private IQueryable<HistoryItemDto> ForUser(int userId) =>
        _set.AsNoTracking()
            .Where(h => h.UserId == userId && !h.Chapter.IsHidden)
            .OrderByDescending(h => h.ReadAt)
            .Select(h => new HistoryItemDto
            {
                ComicId = h.ComicId,
                ComicTitle = h.Comic.Title,
                CoverUrl = h.Comic.CoverUrl,
                ChapterId = h.ChapterId,
                ChapterNumber = h.Chapter.Number,
                ChapterTitle = h.Chapter.Title,
                ReadAt = h.ReadAt
            });

    public async Task<PagedResult<HistoryItemDto>> GetByUserAsync(int userId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var q = ForUser(userId);
        var total = await q.CountAsync();
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<HistoryItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalItems = total
        };
    }

    public Task<HistoryItemDto?> GetForComicAsync(int userId, int comicId) =>
        ForUser(userId).FirstOrDefaultAsync(h => h.ComicId == comicId);

    // Lưu "đã đọc tới chương này". Mỗi người chỉ có 1 dòng cho mỗi truyện (chương đọc gần nhất)
    public async Task<bool> SaveProgressAsync(int userId, int chapterId)
    {
        // Lấy truyện từ chính chương (không tin dữ liệu client), và chỉ nhận chương đang hiển thị
        var comicId = await _db.Chapters
            .Where(c => c.Id == chapterId && !c.IsHidden)
            .Select(c => (int?)c.ComicId)
            .FirstOrDefaultAsync();

        if (comicId is null) return false;

        var now = DateTime.UtcNow;

        // Thử cập nhật dòng đã có trước
        var updated = await UpdateRowAsync(userId, comicId.Value, chapterId, now);
        if (updated > 0) return true;

        // Chưa có thì thêm mới
        try
        {
            _set.Add(new ReadingHistory
            {
                UserId = userId,
                ComicId = comicId.Value,
                ChapterId = chapterId,
                ReadAt = now
            });
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Hai yêu cầu cùng lúc tạo dòng đầu tiên: dòng đã có rồi, chỉ cần cập nhật lại
            _db.ChangeTracker.Clear();
            await UpdateRowAsync(userId, comicId.Value, chapterId, now);
        }
        return true;
    }

    private Task<int> UpdateRowAsync(int userId, int comicId, int chapterId, DateTime now) =>
        _set.Where(h => h.UserId == userId && h.ComicId == comicId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(h => h.ChapterId, chapterId)
                .SetProperty(h => h.ReadAt, now));

    public Task<int> RemoveForComicAsync(int userId, int comicId) =>
        _set.Where(h => h.UserId == userId && h.ComicId == comicId).ExecuteDeleteAsync();

    public Task<int> ClearAsync(int userId) =>
        _set.Where(h => h.UserId == userId).ExecuteDeleteAsync();
}