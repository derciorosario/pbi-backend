const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIndustrySubsubCategory = sequelize.define(
    "UserIndustrySubsubCategory",
    {
      userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      industrySubsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    {
      tableName: "user_industry_subsubcategories",
      timestamps: true,
    }
  );
  return UserIndustrySubsubCategory;
};
