namespace ComicApi.Services.Chat;

public enum ChatIntent
{
    Suggest,         // gợi ý truyện
    Hot,             // truyện xem nhiều
    Latest,          // truyện mới cập nhật
    Summary,         // tóm tắt nội dung một truyện
    CommentSummary,  // tóm tắt bình luận của một truyện
    General          // chung chung hoặc ngoài phạm vi
}

public static class IntentDetector
{
    // Các từ khóa đã bỏ dấu, viết thường
    private static readonly string[] CommentKeys =
        { "binh luan", "comment", "danh gia", "review", "doc gia", "nguoi doc", "moi nguoi noi", "phan hoi" };

    private static readonly string[] SummaryKeys =
        { "tom tat", "noi dung", "cot truyen", "ke ve", "noi ve gi", "ve gi", "gioi thieu ve", "ke cho" };

    private static readonly string[] HotKeys =
        { "hot", "xem nhieu", "doc nhieu", "pho bien", "noi tieng", "thinh hanh", "top", "hay nhat", "nhieu nguoi doc" };

    private static readonly string[] LatestKeys =
        { "moi nhat", "moi cap nhat", "cap nhat", "vua ra", "moi ra", "chuong moi", "truyen moi", "gan day", "gi moi" };

    private static readonly string[] SuggestKeys =
        { "goi y", "de xuat", "de cu", "nen doc", "recommend", "tim truyen", "co truyen", "truyen nao",
          "muon doc", "doc gi", "truyen ve", "the loai", "giong" };

    // Mọi từ nằm trong các từ khóa trên (để loại khỏi từ khóa tìm kiếm)
    public static readonly HashSet<string> KeyWords = new(
        CommentKeys.Concat(SummaryKeys).Concat(HotKeys).Concat(LatestKeys).Concat(SuggestKeys)
                   .SelectMany(k => k.Split(' ')));

    // Thứ tự kiểm tra quan trọng: "tóm tắt bình luận" chứa cả "tóm tắt" lẫn "bình luận" -> ưu tiên bình luận
    public static ChatIntent Detect(string normalizedMessage, bool mentionsComic)
    {
        bool Has(string[] keys) => keys.Any(k => TextUtil.ContainsPhrase(normalizedMessage, k));

        if (Has(CommentKeys)) return ChatIntent.CommentSummary;
        if (Has(SummaryKeys)) return ChatIntent.Summary;
        if (Has(HotKeys)) return ChatIntent.Hot;
        if (Has(LatestKeys)) return ChatIntent.Latest;
        if (Has(SuggestKeys)) return ChatIntent.Suggest;

        // Chỉ nhắc tên một truyện mà không nói gì thêm: coi như muốn biết về truyện đó
        if (mentionsComic) return ChatIntent.Summary;

        return ChatIntent.General;
    }
}
