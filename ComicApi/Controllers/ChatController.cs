using ComicApi.DTOs.Chat;
using ComicApi.Models;
using ComicApi.Services;
using ComicApi.Services.Chat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ComicApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IChatService _chat;
    private readonly ILlmClient _llm;

    public ChatController(IChatService chat, ILlmClient llm)
    {
        _chat = chat;
        _llm = llm;
    }

    // POST /api/Chat: ai cũng dùng được (khách cũng chat được), nhưng bị giới hạn tốc độ để không cạn hạn mức AI
    [HttpPost]
    [EnableRateLimiting("chat")]
    public async Task<IActionResult> Ask(ChatRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _chat.AskAsync(request.Message, ct));
        }
        catch (LlmException ex)
        {
            // Chỉ lỗi cấu hình (thiếu key/model) mới đến được đây, lỗi khi gọi AI đã được xử lý trong ChatService
            return StatusCode(ex.StatusCode, new { message = ex.Message });
        }
    }

    // Dành cho admin: xem các model dùng được với key hiện tại
    [HttpGet("test/models")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Models()
    {
        try
        {
            return Ok(await _llm.ListModelsAsync());
        }
        catch (LlmException ex)
        {
            return StatusCode(ex.StatusCode, new { message = ex.Message, detail = ex.Detail });
        }
    }
}
