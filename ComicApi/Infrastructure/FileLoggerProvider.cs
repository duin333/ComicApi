using System.Text;
using System.Threading.Channels;

namespace ComicApi.Infrastructure;

// Cấu hình đọc từ appsettings.json, mục "Logging:File"
public class FileLoggerOptions
{
    public string Path { get; set; } = "logs";     // thư mục chứa log (tính từ thư mục chạy ứng dụng)
    public int RetainDays { get; set; } = 14;      // giữ log bao nhiêu ngày
}

public static class FileLoggerExtensions
{
    public static ILoggingBuilder AddFileLogging(this ILoggingBuilder logging, IConfiguration config)
    {
        var options = config.GetSection("Logging:File").Get<FileLoggerOptions>() ?? new FileLoggerOptions();
        logging.AddProvider(new FileLoggerProvider(options));
        return logging;
    }
}

// Ghi log ra tệp logs/comichub-yyyyMMdd.log, mỗi ngày một tệp.
// Các luồng xử lý yêu cầu chỉ ném dòng log vào hàng đợi (rất nhanh); một luồng nền duy nhất mới ghi xuống đĩa,
// nên yêu cầu của người dùng không bị chậm vì ghi tệp và các dòng log không bao giờ bị trộn vào nhau
public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly Channel<string> _queue = Channel.CreateBounded<string>(
        new BoundedChannelOptions(10_000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    private readonly string _dir;
    private readonly int _retainDays;
    private readonly Task _worker;

    public FileLoggerProvider(FileLoggerOptions options)
    {
        _dir = System.IO.Path.GetFullPath(options.Path);
        _retainDays = Math.Max(1, options.RetainDays);
        _worker = Task.Run(WriteLoopAsync);
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(categoryName, _queue.Writer);

    public void Dispose()
    {
        _queue.Writer.TryComplete();          // báo hết log; luồng nền ghi nốt phần còn lại rồi dừng
        _worker.Wait(TimeSpan.FromSeconds(5));
    }

    private async Task WriteLoopAsync()
    {
        StreamWriter? writer = null;
        var day = default(DateOnly);

        try
        {
            await foreach (var entry in _queue.Reader.ReadAllAsync())
            {
                try
                {
                    var today = DateOnly.FromDateTime(DateTime.Now);
                    if (writer is null || today != day)         // sang ngày mới hoặc lần đầu: mở tệp của ngày đó
                    {
                        writer?.Dispose();
                        Directory.CreateDirectory(_dir);
                        var stream = new FileStream(System.IO.Path.Combine(_dir, $"comichub-{today:yyyyMMdd}.log"),
                            FileMode.Append, FileAccess.Write, FileShare.ReadWrite);   // vẫn mở xem được bằng Notepad khi đang chạy
                        writer = new StreamWriter(stream, new UTF8Encoding(false)) { AutoFlush = true };
                        day = today;
                        DeleteOldFiles(today);
                    }

                    await writer.WriteAsync(entry);
                }
                catch
                {
                    // Ghi log lỗi (hết dung lượng, thư mục bị khóa...) thì bỏ dòng đó chứ không được làm sập ứng dụng
                    writer?.Dispose();
                    writer = null;
                }
            }
        }
        finally
        {
            writer?.Dispose();
        }
    }

    // Xóa tệp log cũ hơn số ngày cho phép (tính theo ngày trong tên tệp, không đụng tới tệp lạ)
    private void DeleteOldFiles(DateOnly today)
    {
        try
        {
            foreach (var file in Directory.GetFiles(_dir, "comichub-*.log"))
            {
                var name = System.IO.Path.GetFileNameWithoutExtension(file);       // comichub-20261104
                if (DateOnly.TryParseExact(name["comichub-".Length..], "yyyyMMdd", out var d) &&
                    d < today.AddDays(-_retainDays))
                    File.Delete(file);
            }
        }
        catch { /* dọn không được thì thôi */ }
    }

    private sealed class FileLogger : ILogger
    {
        private readonly string _category;
        private readonly ChannelWriter<string> _writer;

        public FileLogger(string category, ChannelWriter<string> writer)
        {
            _category = category;
            _writer = writer;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            // Chặn "giả mạo dòng log": đường dẫn hay tên do người dùng gõ có thể chứa ký tự xuống dòng
            // rồi tự viết thêm một dòng log giả. Đổi xuống dòng trong nội dung thành \n (chữ), còn
            // dấu vết lỗi (stack trace) do hệ thống tạo ra nên giữ nguyên
            var message = formatter(state, exception).Replace("\r", "").Replace("\n", "\\n");

            var sb = new StringBuilder(256);
            sb.Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"))
              .Append(" [").Append(Short(logLevel)).Append("] ")
              .Append(_category).Append(": ").Append(message);
            if (exception is not null) sb.AppendLine().Append(exception);
            sb.AppendLine();

            _writer.TryWrite(sb.ToString());
        }

        private static string Short(LogLevel l) => l switch
        {
            LogLevel.Trace => "TRC",
            LogLevel.Debug => "DBG",
            LogLevel.Information => "INF",
            LogLevel.Warning => "WRN",
            LogLevel.Error => "ERR",
            _ => "CRT"
        };
    }
}
