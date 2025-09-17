// models/userIndustryCategory.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIndustryCategory = sequelize.define(
    "UserIndustryCategory",
    {
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      industryCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'industry_categories',
          key: 'id'
        }
      },
    },
    {
      tableName: "user_industry_categories",
      timestamps: true,
    }
  );

  // Add the association to IndustryCategory
  UserIndustryCategory.associate = (models) => {
    UserIndustryCategory.belongsTo(models.IndustryCategory, {
      foreignKey: 'industryCategoryId',
      as: 'industryCategory'
    });
  };

  return UserIndustryCategory;
};
