const { Category, Subcategory } = require("../models");

exports.getTree = async (req, res) => {
  const rows = await Category.findAll({
    include: [{ model: Subcategory, as: "subcategories", required: false }],
    order: [
      ["name", "ASC"],
      [{ model: Subcategory, as: "subcategories" }, "name", "ASC"],
    ],
  });
  res.json({ categories: rows });
};
