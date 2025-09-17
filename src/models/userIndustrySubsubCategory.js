const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIndustrySubsubCategory = sequelize.define(
    "UserIndustrySubsubCategory",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      industrySubsubCategoryId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: "user_industry_subsubcategories",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["userId", "industrySubsubCategoryId"],
          name: "uniq_user_subsubcat", // 👈 short, safe name
        },
      ],
    }
  );
  return UserIndustrySubsubCategory;
};
