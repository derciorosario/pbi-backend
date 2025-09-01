const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define(
    "Profile",
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
      // 🔑 FR-5: Primary Identity (Entrepreneur, Seller, etc.)
      primaryIdentity: {
        type: DataTypes.ENUM(
          "Entrepreneur",
          "Seller",
          "Buyer",
          "Job Seeker",
          "Recruiter",
          "Investor",
          "Other"
        ),
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      subcategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // in src/models/profile.js fields:
     onboardingProfileTypeDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
     onboardingCategoriesDone:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
     onboardingGoalsDone:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // You can later extend with portfolio, CV links, etc.
    },
    {
      tableName: "profiles",
      timestamps: true,
    }
  );

  return Profile;
};
