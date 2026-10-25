using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ComicApi.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingsAndCommentGif : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GifUrl",
                table: "comments",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ratings",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ComicId = table.Column<int>(type: "int", nullable: false),
                    Stars = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ratings", x => new { x.UserId, x.ComicId });
                    table.CheckConstraint("CK_ratings_stars", "Stars BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "FK_ratings_comics_ComicId",
                        column: x => x.ComicId,
                        principalTable: "comics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ratings_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ratings_ComicId",
                table: "ratings",
                column: "ComicId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ratings");

            migrationBuilder.DropColumn(
                name: "GifUrl",
                table: "comments");
        }
    }
}
