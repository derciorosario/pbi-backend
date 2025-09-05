const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Product",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who sells the product
      sellerUserId: { type: DataTypes.UUID, allowNull: false },

      // Basic info
      title: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },

      // Pricing & Inventory
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: true },

      // Location
      country: { type: DataTypes.STRING(80), allowNull: true },

      // Tags & Images
      tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      images: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    },
    {
      tableName: "products",
      timestamps: true,
      indexes: [{ fields: ["sellerUserId"] }],
    }
  );

  Product.associate = (models) => {
    Product.belongsTo(models.User, { foreignKey: "sellerUserId", as: "seller" });
    Product.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    Product.belongsTo(models.Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });
  };

  return Product;
};