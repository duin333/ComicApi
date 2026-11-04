using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ComicApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCommentRepliesAndLikes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ParentId",
                table: "comments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReplyToUserId",
                table: "comments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "comment_likes",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CommentId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_likes", x => new { x.UserId, x.CommentId });
                    table.ForeignKey(
                        name: "FK_comment_likes_comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_comment_likes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_comments_ComicId_ParentId_CreatedAt",
                table: "comments",
                columns: new[] { "ComicId", "ParentId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_comments_ParentId",
                table: "comments",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_comments_ReplyToUserId",
                table: "comments",
                column: "ReplyToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_comment_likes_CommentId",
                table: "comment_likes",
                column: "CommentId");

            migrationBuilder.AddForeignKey(
                name: "FK_comments_comments_ParentId",
                table: "comments",
                column: "ParentId",
                principalTable: "comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_comments_users_ReplyToUserId",
                table: "comments",
                column: "ReplyToUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_comments_comments_ParentId",
                table: "comments");

            migrationBuilder.DropForeignKey(
                name: "FK_comments_users_ReplyToUserId",
                table: "comments");

            migrationBuilder.DropTable(
                name: "comment_likes");

            migrationBuilder.DropIndex(
                name: "IX_comments_ComicId_ParentId_CreatedAt",
                table: "comments");

            migrationBuilder.DropIndex(
                name: "IX_comments_ParentId",
                table: "comments");

            migrationBuilder.DropIndex(
                name: "IX_comments_ReplyToUserId",
                table: "comments");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "comments");

            migrationBuilder.DropColumn(
                name: "ReplyToUserId",
                table: "comments");
        }
    }
}
