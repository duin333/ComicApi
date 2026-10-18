using ComicApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ComicApi.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(u => u.Id);
        b.Property(u => u.Username).IsRequired().HasMaxLength(50);
        b.Property(u => u.Email).IsRequired().HasMaxLength(100);
        b.Property(u => u.PasswordHash).IsRequired().HasMaxLength(200);
        b.Property(u => u.Role).IsRequired().HasMaxLength(20);
        b.HasIndex(u => u.Username).IsUnique();   // không trùng tên đăng nhập
        b.HasIndex(u => u.Email).IsUnique();      // không trùng email
    }
}