using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ComicApi.AuthTests;

// Một "người dùng" trong bài test: khách (không token), reader, admin...
public class Actor
{
    public string Name { get; }
    public string? Username { get; }
    public string? Password { get; }
    public string? Token { get; set; }
    public int Id { get; set; }

    public Actor(string name, string? username = null, string? password = null)
    {
        Name = name;
        Username = username;
        Password = password;
    }
}

public record Resp(int Status, string Body, Dictionary<string, string> Headers)
{
    public JsonNode? Json
    {
        get { try { return JsonNode.Parse(Body); } catch { return null; } }
    }

    public string? Header(string name) =>
        Headers.TryGetValue(name.ToLowerInvariant(), out var v) ? v : null;

    public bool BodyHasId(int id) =>
        System.Text.RegularExpressions.Regex.IsMatch(Body, "\"id\"\\s*:\\s*" + id + @"(?!\d)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}

public class Api
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public Api(string baseUrl, bool skipCertCheck)
    {
        var handler = new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false };
        if (skipCertCheck)
            handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;

        _http = new HttpClient(handler) { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(30) };
    }

    // rawAuth: ghi đè nguyên giá trị header Authorization (dùng để thử token giả)
    public async Task<Resp> Send(Actor? who, string method, string path, object? body = null,
        string? rawAuth = null, Dictionary<string, string>? headers = null)
    {
        var req = new HttpRequestMessage(new HttpMethod(method), path);
        if (body is not null)
            req.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");

        Authorize(req, who, rawAuth);
        if (headers is not null)
            foreach (var h in headers) req.Headers.TryAddWithoutValidation(h.Key, h.Value);

        return await Execute(req);
    }

    public async Task<Resp> SendFile(Actor? who, string path, string field, string fileName, byte[] bytes, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);

        var form = new MultipartFormDataContent { { file, field, fileName } };
        var req = new HttpRequestMessage(HttpMethod.Post, path) { Content = form };
        Authorize(req, who, null);
        return await Execute(req);
    }

    private static void Authorize(HttpRequestMessage req, Actor? who, string? rawAuth)
    {
        if (rawAuth is not null) req.Headers.TryAddWithoutValidation("Authorization", rawAuth);
        else if (who?.Token is not null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", who.Token);
    }

    private async Task<Resp> Execute(HttpRequestMessage req)
    {
        using var res = await _http.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();

        var headers = new Dictionary<string, string>();
        foreach (var h in res.Headers) headers[h.Key.ToLowerInvariant()] = string.Join(", ", h.Value);
        foreach (var h in res.Content.Headers) headers[h.Key.ToLowerInvariant()] = string.Join(", ", h.Value);

        return new Resp((int)res.StatusCode, body, headers);
    }
}
