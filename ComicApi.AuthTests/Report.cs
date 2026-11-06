using System.Text;

namespace ComicApi.AuthTests;

public record Check(string Group, string Label, string Col, string Expect, string Actual, bool Pass, string? Note);

// Ghi nhận từng phép kiểm tra, in ra màn hình và xuất báo cáo Markdown
public class Recorder
{
    public List<Check> Checks { get; } = new();
    private string _group = "";

    public void Group(string name)
    {
        _group = name;
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"\n=== {name} ===");
        Console.ResetColor();
    }

    public void Info(string text)
    {
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine("  ℹ  " + text);
        Console.ResetColor();
    }

    // expect: "401", "403", "2xx", "200|204", hoặc "!401/403" (đã vượt qua bước phân quyền, kết quả gì cũng được trừ 401/403)
    public bool Add(string label, string col, int actual, string expect, string? note = null, string? group = null)
    {
        var pass = Matches(actual, expect);
        Push(label, col, expect, actual.ToString(), pass, note, group);
        return pass;
    }

    public bool AddBool(string label, bool ok, string expect, string actual)
    {
        Push(label, "—", expect, actual, ok, null);
        return ok;
    }

    private void Push(string label, string col, string expect, string actual, bool pass, string? note, string? group = null)
    {
        Checks.Add(new Check(group ?? _group, label, col, expect, actual, pass, note));

        Console.ForegroundColor = pass ? ConsoleColor.Green : ConsoleColor.Red;
        Console.Write(pass ? "  ĐẠT " : "  LỖI ");
        Console.ResetColor();
        Console.WriteLine($"[{col,-5}] {label}  → {actual} (cần {expect}){(note is null ? "" : "  · " + note)}");
    }

    public static bool Matches(int actual, string expect)
    {
        foreach (var raw in expect.Split('|'))
        {
            var t = raw.Trim();
            if (t == "2xx" && actual is >= 200 and < 300) return true;
            if (t == "!401/403" && actual != 401 && actual != 403) return true;
            if (int.TryParse(t, out var n) && n == actual) return true;
        }
        return false;
    }

    public int Failures => Checks.Count(c => !c.Pass);

    public void WriteMarkdown(string path, string baseUrl)
    {
        var sb = new StringBuilder();
        var total = Checks.Count;
        var failed = Failures;

        sb.AppendLine("# Báo cáo kiểm tra phân quyền ComicHub");
        sb.AppendLine();
        sb.AppendLine($"- Thời điểm chạy: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine($"- Máy chủ được thử: {baseUrl}");
        sb.AppendLine($"- Kết quả: **{total - failed}/{total} đạt**" + (failed == 0 ? " ✅" : $", **{failed} LỖI** ❌"));
        sb.AppendLine();
        sb.AppendLine("Ký hiệu trong bảng: `✓ 401` = đạt, nhận đúng mã 401. `✗ 200 (cần 401)` = LỖI phân quyền. `—` = không áp dụng hoặc không thử.");

        // Bảng ma trận: endpoint x vai trò (chỉ các nhóm có cột Khách / Reader / Admin)
        var matrixGroups = Checks.Where(c => c.Col is "Khách" or "Reader" or "Admin").Select(c => c.Group).Distinct().ToList();
        foreach (var g in matrixGroups.OrderBy(x => x))
        {
            sb.AppendLine();
            sb.AppendLine($"## {g}");
            sb.AppendLine();
            sb.AppendLine("| Điểm cuối | Khách | Reader | Admin |");
            sb.AppendLine("|---|---|---|---|");

            foreach (var label in Checks.Where(c => c.Group == g && c.Col is "Khách" or "Reader" or "Admin").Select(c => c.Label).Distinct())
            {
                string Cell(string col)
                {
                    var cs = Checks.Where(c => c.Group == g && c.Label == label && c.Col == col).ToList();
                    if (cs.Count == 0) return "—";
                    var bad = cs.FirstOrDefault(c => !c.Pass);
                    return bad is not null ? $"✗ {bad.Actual} (cần {bad.Expect})" : $"✓ {cs.Last().Actual}";
                }
                sb.AppendLine($"| `{label}` | {Cell("Khách")} | {Cell("Reader")} | {Cell("Admin")} |");
            }
        }

        // Các nhóm còn lại: liệt kê từng phép thử
        var otherGroups = Checks.Where(c => c.Col == "—").Select(c => c.Group).Distinct().ToList();
        foreach (var g in otherGroups.OrderBy(x => x))
        {
            sb.AppendLine();
            sb.AppendLine($"## {g}");
            sb.AppendLine();
            sb.AppendLine("| Phép thử | Mong đợi | Thực tế | Kết quả |");
            sb.AppendLine("|---|---|---|---|");
            foreach (var c in Checks.Where(c => c.Group == g && c.Col == "—"))
                sb.AppendLine($"| {c.Label} | {c.Expect} | {c.Actual} | {(c.Pass ? "✓ đạt" : "✗ LỖI")} |");
        }

        if (failed > 0)
        {
            sb.AppendLine();
            sb.AppendLine("## Danh sách lỗi cần sửa");
            sb.AppendLine();
            foreach (var c in Checks.Where(c => !c.Pass))
                sb.AppendLine($"- **{c.Label}** ({c.Col}): nhận {c.Actual}, cần {c.Expect}. Nhóm: {c.Group}");
        }

        File.WriteAllText(path, sb.ToString(), new UTF8Encoding(true));
    }
}
