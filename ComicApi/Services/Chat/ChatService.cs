using System.Text.Json;
using System.Text.RegularExpressions;
using ComicApi.DTOs.Chat;
using ComicApi.Repositories;

namespace ComicApi.Services.Chat;

public interface IChatService
{
    Task<ChatResponse> AskAsync(string message, CancellationToken ct = default);
}

public class ChatService : IChatService
{
    private const int MaxCandidates = 6;

    // Từ phổ biến, không mang nghĩa tìm kiếm (đã bỏ dấu), cộng thêm các từ trong từ khóa ý định
    private static readonly HashSet<string> Stopwords = new(IntentDetector.KeyWords)
    {
        "toi", "minh", "ban", "cho", "mot", "cac", "nhung", "nao", "gi", "khong", "co", "la", "ve",
        "muon", "doc", "truyen", "tranh", "hay", "nhieu", "duoc", "voi", "nay", "kia", "can", "giup",
        "xin", "vui", "long", "nua", "di", "nhe", "oi", "loai", "thu", "vi", "dang", "thich", "kieu",
        "nhu", "khoang", "hoi", "biet", "bot", "cua", "trong", "tren", "duoi", "hon", "rat", "qua",
        "lam", "se", "da", "va", "hoac", "the", "xem", "tim"
    };

    // Cách nói thường gặp -> thể loại (đã bỏ dấu). Chỉ áp dụng nếu website có thể loại đó
    private static readonly Dictionary<string, string> GenreSynonyms = new()
    {
        ["buon cuoi"] = "hai huoc", ["cuoi"] = "hai huoc",
        ["rung ron"] = "kinh di",
        ["tinh yeu"] = "tinh cam", ["lang man"] = "tinh cam", ["ngon tinh"] = "tinh cam",
        ["danh nhau"] = "hanh dong", ["chien dau"] = "hanh dong",
        ["hoc sinh"] = "hoc duong", ["truong hoc"] = "hoc duong",
        ["kiem hiep"] = "co dai", ["co trang"] = "co dai",
        ["vu tru"] = "vien tuong", ["khoa hoc"] = "vien tuong", ["tuong lai"] = "vien tuong",
        ["bong da"] = "the thao"
    };

    private readonly IChatRepository _repo;
    private readonly ILlmClient _llm;
    private readonly ILogger<ChatService> _logger;

    public ChatService(IChatRepository repo, ILlmClient llm, ILogger<ChatService> logger)
    {
        _repo = repo;
        _llm = llm;
        _logger = logger;
    }

    // Kế hoạch trả lời cho một câu hỏi
    private sealed record Plan(
        ChatIntent Intent,
        string SystemPrompt,
        IReadOnlyList<ChatComicInfo> Candidates,    // những truyện AI được phép nhắc tới
        IReadOnlyList<ChatComicInfo> DefaultCards,  // thẻ truyện hiển thị nếu AI không chọn được
        bool ForceCards,                            // true: luôn hiển thị toàn bộ ứng viên (hot, mới)
        string FallbackReply);                      // câu trả lời khi AI lỗi

    public async Task<ChatResponse> AskAsync(string message, CancellationToken ct = default)
    {
        message = message.Trim();

        var catalog = await _repo.GetCatalogAsync();
        if (catalog.Count == 0)
            return Build(ChatIntent.General, "Website chưa có truyện nào để mình tư vấn.", Array.Empty<ChatComicInfo>());

        var norm = TextUtil.Normalize(message);
        var genreNames = catalog.SelectMany(c => c.Genres).Distinct().OrderBy(g => g).ToList();
        var mentioned = FindMentionedComic(norm, catalog);
        var intent = IntentDetector.Detect(norm, mentioned is not null);

        return intent switch
        {
            ChatIntent.Hot or ChatIntent.Latest => await HotOrLatestAsync(intent, catalog, message, ct),
            ChatIntent.Suggest => await SuggestAsync(catalog, genreNames, norm, mentioned, message, ct),
            ChatIntent.Summary => await SummaryAsync(catalog, norm, mentioned, message, ct),
            ChatIntent.CommentSummary => await CommentSummaryAsync(catalog, norm, mentioned, message, ct),
            _ => await GeneralAsync(genreNames, message, ct)
        };
    }

    // ---------- Từng loại câu hỏi ----------
    private Task<ChatResponse> HotOrLatestAsync(
        ChatIntent intent, List<ChatComicInfo> catalog, string message, CancellationToken ct)
    {
        var top = (intent == ChatIntent.Hot
                ? catalog.OrderByDescending(c => c.ViewCount)
                : catalog.OrderByDescending(c => c.UpdatedAt))
            .Take(MaxCandidates).ToList();

        var plan = new Plan(intent, PromptBuilder.ForComics(intent, top), top, top, ForceCards: true,
            FallbackReply: intent == ChatIntent.Hot
                ? "Đây là các truyện đang được xem nhiều nhất:"
                : "Đây là các truyện mới cập nhật gần đây:");

        return RunAsync(plan, message, ct);
    }

    private Task<ChatResponse> SuggestAsync(
        List<ChatComicInfo> catalog, List<string> genreNames, string norm,
        ChatComicInfo? mentioned, string message, CancellationToken ct)
    {
        var genres = DetectGenres(norm, genreNames);
        var tokens = ExtractTokens(norm);
        IEnumerable<ChatComicInfo> pool = catalog;

        if (mentioned is not null)
        {
            // "Gợi ý truyện giống X": lấy thể loại của X để tìm truyện tương tự và bỏ chính X ra
            genres = mentioned.Genres.ToList();
            tokens = new List<string>();
            pool = catalog.Where(c => c.Id != mentioned.Id);
        }
        else
        {
            // Từ nào đã thuộc tên thể loại thì không dùng làm từ khóa nữa
            var genreWords = genres.SelectMany(g => TextUtil.Normalize(g).Split(' ')).ToHashSet();
            tokens.RemoveAll(genreWords.Contains);
        }

        // Quá chung chung (không thể loại, không từ khóa): để bot hỏi lại người dùng
        if (genres.Count == 0 && tokens.Count == 0)
            return GeneralAsync(genreNames, message, ct);

        var ranked = Rank(pool, genres, tokens);

        // Không có truyện nào khớp: trả lời luôn, KHÔNG hỏi AI (để AI không bịa)
        if (ranked.Count == 0)
        {
            var popular = catalog.OrderByDescending(c => c.ViewCount).Take(3).ToList();
            var sample = string.Join(", ", genreNames.Take(4));
            return Task.FromResult(Build(ChatIntent.Suggest,
                $"Mình chưa tìm thấy truyện nào phù hợp với yêu cầu này trên website. Bạn thử nói thể loại khác nhé (ví dụ: {sample}). " +
                "Còn đây là vài truyện đang được xem nhiều:", popular));
        }

        var candidates = ranked.Take(MaxCandidates).Select(x => x.Comic).ToList();
        var plan = new Plan(ChatIntent.Suggest, PromptBuilder.ForComics(ChatIntent.Suggest, candidates),
            candidates, candidates.Take(3).ToList(), ForceCards: false,
            FallbackReply: "Mình chưa phân tích kỹ được lúc này, đây là vài truyện có thể hợp với bạn:");

        return RunAsync(plan, message, ct);
    }

    private async Task<ChatResponse> SummaryAsync(
        List<ChatComicInfo> catalog, string norm, ChatComicInfo? mentioned, string message, CancellationToken ct)
    {
        var comic = mentioned ?? FindByTokens(catalog, norm);

        // Truyện không có trên website: trả lời luôn, không hỏi AI
        if (comic is null)
            return Build(ChatIntent.Summary,
                "Mình chưa tìm thấy truyện nào có tên như vậy trên website. Bạn kiểm tra lại tên truyện, " +
                "hoặc nhờ mình gợi ý truyện theo thể loại nhé.", Array.Empty<ChatComicInfo>());

        var desc = TextUtil.Clean(comic.Description, 600);
        var fallback = desc.Length > 0
            ? $"Giới thiệu truyện “{comic.Title}”: {desc}"
            : $"Truyện “{comic.Title}” hiện chưa có mô tả.";

        var one = new List<ChatComicInfo> { comic };
        var plan = new Plan(ChatIntent.Summary, PromptBuilder.ForComics(ChatIntent.Summary, one),
            one, one, ForceCards: false, FallbackReply: fallback);

        return await RunAsync(plan, message, ct);
    }

    private async Task<ChatResponse> CommentSummaryAsync(
        List<ChatComicInfo> catalog, string norm, ChatComicInfo? mentioned, string message, CancellationToken ct)
    {
        var comic = mentioned ?? FindByTokens(catalog, norm);

        if (comic is null)
            return Build(ChatIntent.CommentSummary,
                "Bạn muốn xem ý kiến độc giả về truyện nào? Hãy nhắc tên truyện giúp mình nhé.",
                Array.Empty<ChatComicInfo>());

        var one = new List<ChatComicInfo> { comic };
        var total = await _repo.CountCommentsAsync(comic.Id);

        if (total == 0)
            return Build(ChatIntent.CommentSummary, $"Truyện “{comic.Title}” chưa có bình luận nào.", one);

        var comments = await _repo.GetRecentCommentsAsync(comic.Id, 30);
        var plan = new Plan(ChatIntent.CommentSummary, PromptBuilder.ForComments(comic, comments, total),
            one, one, ForceCards: false,
            FallbackReply: $"Truyện “{comic.Title}” có {total} bình luận. Mình chưa tóm tắt được lúc này, " +
                           "bạn có thể xem trực tiếp ở trang truyện nhé.");

        return await RunAsync(plan, message, ct);
    }

    private Task<ChatResponse> GeneralAsync(List<string> genreNames, string message, CancellationToken ct)
    {
        const string help =
            "Mình là Comic Meow Bot. Mình có thể gợi ý truyện theo thể loại, tóm tắt nội dung truyện, " +
            "tóm tắt bình luận của độc giả, và cho bạn biết truyện nào đang hot hoặc mới cập nhật. " +
            "Bạn thử hỏi: “Gợi ý truyện hài hước” hoặc “Truyện nào đang hot?” nhé.";

        var plan = new Plan(ChatIntent.General, PromptBuilder.ForGeneral(genreNames),
            Array.Empty<ChatComicInfo>(), Array.Empty<ChatComicInfo>(), ForceCards: false, FallbackReply: help);

        return RunAsync(plan, message, ct);
    }

    // ---------- Gọi AI và kiểm tra kết quả ----------
    private async Task<ChatResponse> RunAsync(Plan plan, string userMessage, CancellationToken ct)
    {
        try
        {
            var raw = await _llm.GenerateAsync(plan.SystemPrompt, userMessage, json: true, ct: ct);
            var (reply, ids) = ParseModelOutput(raw);

            if (string.IsNullOrWhiteSpace(reply)) return Fallback(plan);

            List<ChatComicInfo> cards;
            if (plan.ForceCards)
            {
                cards = plan.Candidates.ToList();
            }
            else
            {
                // Chỉ nhận id nằm trong danh sách đã đưa cho AI (chặn id bịa), thông tin thẻ lấy từ database
                cards = ids.Distinct()
                    .Select(id => plan.Candidates.FirstOrDefault(c => c.Id == id))
                    .Where(c => c is not null)
                    .Select(c => c!)
                    .Take(3)
                    .ToList();

                if (cards.Count == 0) cards = plan.DefaultCards.ToList();
            }

            return Build(plan.Intent, reply.Trim(), cards);
        }
        catch (LlmException ex) when (ex.StatusCode != 500)   // 500 = thiếu cấu hình, để lỗi nổi lên cho dev thấy
        {
            _logger.LogWarning("AI lỗi {Status}: {Message} | {Detail}", ex.StatusCode, ex.Message, ex.Detail);

            // Dự phòng: AI lỗi (hết hạn mức, timeout...) vẫn trả lời bằng dữ liệu có sẵn
            var prefix = ex.StatusCode == 429 ? "Chatbot AI đang quá tải nên mình trả lời tạm bằng dữ liệu có sẵn. " : "";
            return Fallback(plan, prefix);
        }
    }

    private static ChatResponse Fallback(Plan plan, string prefix = "") =>
        Build(plan.Intent, prefix + plan.FallbackReply, plan.ForceCards ? plan.Candidates : plan.DefaultCards);

    private static (string Reply, List<int> Ids) ParseModelOutput(string raw)
    {
        var text = raw.Trim();

        // Bỏ rào ```json ... ``` nếu mô hình lỡ thêm vào
        if (text.StartsWith("```"))
            text = Regex.Replace(text, @"^```(?:json)?\s*|\s*```$", "", RegexOptions.IgnoreCase).Trim();

        // Model free đôi khi thêm chữ thừa quanh JSON: cắt từ dấu { đầu tiên đến dấu } cuối cùng
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start > 0 && end > start) text = text[start..(end + 1)];

        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (text, new List<int>());

            var reply = root.TryGetProperty("reply", out var r) && r.ValueKind == JsonValueKind.String
                ? r.GetString() ?? ""
                : "";

            var ids = new List<int>();
            if (root.TryGetProperty("comicIds", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var x in arr.EnumerateArray())
                    if (x.ValueKind == JsonValueKind.Number && x.TryGetInt32(out var id)) ids.Add(id);
            }
            return (reply, ids);
        }
        catch (JsonException)
        {
            // Không phải JSON: dùng nguyên văn làm câu trả lời, không kèm thẻ truyện
            return (text, new List<int>());
        }
    }

    private static ChatResponse Build(ChatIntent intent, string reply, IEnumerable<ChatComicInfo> comics) => new()
    {
        Reply = reply,
        Intent = intent.ToString(),
        Comics = comics.Select(c => new ChatComicDto
        {
            Id = c.Id,
            Title = c.Title,
            CoverUrl = c.CoverUrl,
            Author = c.Author,
            Status = c.Status
        }).ToList()
    };

    // ---------- Tìm kiếm trong danh sách truyện ----------

    // Tên truyện nào xuất hiện trong câu hỏi (chọn tên dài nhất nếu trùng nhiều)
    private static ChatComicInfo? FindMentionedComic(string norm, IEnumerable<ChatComicInfo> catalog) =>
        catalog.Where(c => TextUtil.ContainsPhrase(norm, TextUtil.Normalize(c.Title)))
               .OrderByDescending(c => c.Title.Length)
               .FirstOrDefault();

    // Truyện khớp nhất theo từ khóa, chỉ nhận khi khớp ở tên hoặc tác giả
    private static ChatComicInfo? FindByTokens(IEnumerable<ChatComicInfo> catalog, string norm)
    {
        var best = Rank(catalog, Array.Empty<string>(), ExtractTokens(norm)).FirstOrDefault();
        return best.Comic is not null && best.Score >= 3 ? best.Comic : null;
    }

    private static List<string> ExtractTokens(string norm) =>
        norm.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 3 && !Stopwords.Contains(t))
            .Distinct()
            .ToList();

    private static List<string> DetectGenres(string norm, IReadOnlyList<string> genreNames)
    {
        var found = new List<string>();

        foreach (var g in genreNames)
            if (TextUtil.ContainsPhrase(norm, TextUtil.Normalize(g))) found.Add(g);

        foreach (var (phrase, genreNorm) in GenreSynonyms)
        {
            if (!TextUtil.ContainsPhrase(norm, phrase)) continue;
            var g = genreNames.FirstOrDefault(x => TextUtil.Normalize(x) == genreNorm);
            if (g is not null && !found.Contains(g)) found.Add(g);
        }
        return found;
    }

    // Chấm điểm: thể loại khớp +2, từ khóa khớp tên +3, tác giả +2, mô tả +1. Điểm bằng nhau thì ưu tiên nhiều lượt xem
    private static List<(ChatComicInfo Comic, int Score)> Rank(
        IEnumerable<ChatComicInfo> catalog, IReadOnlyCollection<string> genres, IReadOnlyCollection<string> tokens)
    {
        var result = new List<(ChatComicInfo Comic, int Score)>();

        foreach (var c in catalog)
        {
            var title = TextUtil.Normalize(c.Title);
            var author = TextUtil.Normalize(c.Author);
            var desc = TextUtil.Normalize(c.Description);

            var score = genres.Count(g => c.Genres.Contains(g)) * 2;
            foreach (var t in tokens)
            {
                if (TextUtil.ContainsPhrase(title, t)) score += 3;
                if (TextUtil.ContainsPhrase(author, t)) score += 2;
                if (TextUtil.ContainsPhrase(desc, t)) score += 1;
            }

            if (score > 0) result.Add((c, score));
        }

        return result.OrderByDescending(x => x.Score).ThenByDescending(x => x.Comic.ViewCount).ToList();
    }
}
