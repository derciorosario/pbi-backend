const {
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../models");

exports.getTree = async (req, res) => {
  try {
    const rows = await IndustryCategory.findAll({
      include: [
        {
          model: IndustrySubcategory,
          as: "subcategories",
          required: false,
          include: [
            {
              model: IndustrySubsubCategory,
              as: "subsubs",
              required: false,
            },
          ],
        },
      ],
      order: [
        ["name", "ASC"],
        [{ model: IndustrySubcategory, as: "subcategories" }, "name", "ASC"],
        [
          { model: IndustrySubcategory, as: "subcategories" },
          { model: IndustrySubsubCategory, as: "subsubs" },
          "name",
          "ASC",
        ],
      ],
    });

    res.json({ industryCategories: rows });
  } catch (err) {
    console.error("Error in getTree (IndustryCategory):", err);
    res.status(500).json({ error: "Internal server error" });
  }
};