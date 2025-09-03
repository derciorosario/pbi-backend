// category.js
const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "categories", timestamps: true, }
  );
  return Category;
};
