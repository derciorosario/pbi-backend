// models/userIndustryCategory.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "UserIndustryCategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      industryCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      tableName: "user_industry_categories",
      timestamps: true,
      indexes: [],
    }
  );
};
