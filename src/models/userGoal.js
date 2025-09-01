// userGoal.js
module.exports = (sequelize, DataTypes) => {
  const UserGoal = sequelize.define(
    "UserGoal",
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      goalId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: "users_goals", timestamps: true }
  );
  return UserGoal;
};
