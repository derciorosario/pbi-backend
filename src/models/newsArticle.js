// src/models/newsArticle.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const NewsArticle = sequelize.define(
    "NewsArticle",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // author
      userId:    { type: DataTypes.UUID, allowNull: false },
      profileId: { type: DataTypes.UUID, allowNull: true },

      // UI: Title
      title: { type: DataTypes.STRING(220), allowNull: false },

      // UI: Category (keep simple enum to match UI)
      category: {
        type: DataTypes.ENUM("Business", "Technology", "Policy", "Trade", "Culture"),
        allowNull: true,
      },

      // UI: Country Focus
      countryFocus: { type: DataTypes.STRING(80), allowNull: true }, // e.g., "All African Countries", "Nigeria", etc.

      // UI: Featured Image (can store base64 or URL)
      featuredImage: { type: DataTypes.TEXT("long"), allowNull: true }, // data:image/... or https://...

      // UI: Article Content
      content: { type: DataTypes.TEXT("long"), allowNull: false },

      // UI: Tags (comma input -> array)
      tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // ["business","africa"]

      // Publication Options
      status: {
        type: DataTypes.ENUM("draft", "published", "scheduled"),
        allowNull: false,
        defaultValue: "published",
      },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      scheduledFor: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "news_articles",
      timestamps: true,
      indexes: [{ fields: ["userId"] }, { fields: ["status"] }, { fields: ["category"] }, { fields: ["countryFocus"] }],
    }
  );

  return NewsArticle;
};
