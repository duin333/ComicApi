using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace ComicApi.DTOs.Admin;

public class UploadCoverRequest
{
    [Required]
    public IFormFile File { get; set; } = null!;
}

public class UploadChapterImagesRequest
{
    [Required]
    public List<IFormFile> Files { get; set; } = new();
}