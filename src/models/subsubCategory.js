const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const SubsubCategory = sequelize.define("SubsubCategory", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    name: { type: DataTypes.STRING(180), allowNull: false },
    //categoryId:    { type: DataTypes.UUID, allowNull: false },
    subcategoryId: { type: DataTypes.UUID, allowNull: false },
  }, { tableName: "subsubcategories", timestamps: true });
  return SubsubCategory;
};
