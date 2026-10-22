namespace ComicApi.Services;

// Lỗi khi gọi dịch vụ AI, kèm mã HTTP mà API của mình sẽ trả về cho client
public class LlmException : Exception
{
    public int StatusCode { get; }
    public string? Detail { get; }

    public LlmException(int statusCode, string message, string? detail = null) : base(message)
    {
        StatusCode = statusCode;
        Detail = detail;
    }
}

// Giao diện chung: muốn đổi nhà cung cấp AI chỉ cần viết lớp mới
public interface ILlmClient
{
    Task<string> GenerateAsync(string systemPrompt, string userMessage, bool json = false, CancellationToken ct = default);
    Task<List<string>> ListModelsAsync(CancellationToken ct = default);
}