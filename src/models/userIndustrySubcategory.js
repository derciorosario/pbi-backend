const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIndustrySubcategory = sequelize.define(
    "UserIndustrySubcategory",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      industrySubcategoryId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: "user_industry_subcategories",
      timestamps: true,
      indexes: [{ fields: ["userId", "industrySubcategoryId"], unique: true }],
    }
  );
  return UserIndustrySubcategory;
};
