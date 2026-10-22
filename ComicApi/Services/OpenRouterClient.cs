using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ComicApi.Services;

public class OpenRouterSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "openrouter/free";
}

public class OpenRouterClient : ILlmClient
{
    private readonly HttpClient _http;
    private readonly OpenRouterSettings _settings;

    public OpenRouterClient(HttpClient http, IOptions<OpenRouterSettings> options)
    {
        _http = http;
        _settings = options.Value;
    }

    public async Task<string> GenerateAsync(
        string systemPrompt, string userMessage, bool json = false, CancellationToken ct = default)
    {
        EnsureConfigured(requireModel: true);

        // Không gửi response_format vì nhiều model free không hỗ trợ.
        // Prompt đã yêu cầu trả JSON, và ChatService.ParseModelOutput tự xử lý nếu model trả sai định dạng.
        var body = new
        {
            model = _settings.Model,
            messages = new object[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            },
            temperature = 0.4,
            max_tokens = 1024
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);

        var raw = await SendAsync(request, ct);

        using var doc = JsonDocument.Parse(raw);
        // Câu trả lời nằm ở choices[0].message.content
        if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0
            && choices[0].TryGetProperty("message", out var message)
            && message.TryGetProperty("content", out var content)
            && content.ValueKind == JsonValueKind.String)
        {
            var text = content.GetString();
            if (!string.IsNullOrWhiteSpace(text)) return text;
        }

        throw new LlmException(502,
            "Mô hình AI không trả về nội dung, hãy thử hỏi lại", raw);
    }

    // Liệt kê các model free hiện có
    public async Task<List<string>> ListModelsAsync(CancellationToken ct = default)
    {
        EnsureConfigured(requireModel: false);

        using var request = new HttpRequestMessage(HttpMethod.Get, "models");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);

        var raw = await SendAsync(request, ct);
        using var doc = JsonDocument.Parse(raw);

        var names = new List<string>();
        if (doc.RootElement.TryGetProperty("data", out var data))
        {
            foreach (var m in data.EnumerateArray())
            {
                var id = m.GetProperty("id").GetString() ?? "";
                if (id.EndsWith(":free")) names.Add(id);
            }
        }
        names.Insert(0, "openrouter/free");
        return names;
    }

    private void EnsureConfigured(bool requireModel)
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new LlmException(500, "Thiếu OpenRouter:ApiKey, hãy đặt trong User Secrets");
        if (requireModel && string.IsNullOrWhiteSpace(_settings.Model))
            throw new LlmException(500, "Thiếu OpenRouter:Model trong appsettings.json");
    }

    private async Task<string> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (TaskCanceledException)
        {
            throw new LlmException(504, "Chatbot phản hồi quá lâu, vui lòng thử lại");
        }
        catch (HttpRequestException ex)
        {
            throw new LlmException(502, "Không kết nối được tới dịch vụ AI", ex.Message);
        }

        using (response)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            if (response.IsSuccessStatusCode) return text;

            throw response.StatusCode switch
            {
                HttpStatusCode.TooManyRequests => new LlmException(429,
                    "Chatbot đang quá tải hoặc đã hết hạn mức miễn phí, hãy thử lại sau", text),
                HttpStatusCode.Unauthorized => new LlmException(502,
                    "Khóa API OpenRouter không hợp lệ", text),
                HttpStatusCode.PaymentRequired or HttpStatusCode.Forbidden => new LlmException(502,
                    "Tài khoản OpenRouter bị giới hạn hoặc hết credit", text),
                HttpStatusCode.NotFound => new LlmException(502,
                    "Không tìm thấy model, hãy đổi OpenRouter:Model", text),
                _ => new LlmException(502, $"Dịch vụ AI trả về lỗi {(int)response.StatusCode}", text)
            };
        }
    }
}