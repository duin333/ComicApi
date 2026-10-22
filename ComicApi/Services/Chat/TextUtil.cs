using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ComicApi.Services.Chat;

public static class TextUtil
{
    // "Mèo Thần Tài!" -> "meo than tai" (bỏ dấu, chữ thường, chỉ giữ chữ và số)
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var decomposed = text.ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }

        return Regex.Replace(sb.ToString(), "[^a-z0-9]+", " ").Trim();
    }

    // Cụm từ phải xuất hiện nguyên từ ("hot" không khớp nhầm trong "photo")
    public static bool ContainsPhrase(string normalizedText, string normalizedPhrase) =>
        normalizedPhrase.Length > 0 && $" {normalizedText} ".Contains($" {normalizedPhrase} ");

    // Làm sạch dữ liệu không đáng tin (bình luận, mô tả) trước khi đưa vào prompt:
    // gộp khoảng trắng, bỏ ký tự < > (để không giả mạo thẻ), cắt gọn
    public static string Clean(string? text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var s = Regex.Replace(text, @"\s+", " ").Replace('<', ' ').Replace('>', ' ').Trim();
        return s.Length <= maxLength ? s : s[..maxLength] + "...";
    }
}
