require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sequelize, Category, Subcategory, Goal } = require("../src/models");

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    // categories
    const cats = JSON.parse(fs.readFileSync(path.join(__dirname, "categories.full.json")));
    for (const [cat, subs] of Object.entries(cats)) {
      const c = await Category.create({ name: cat });
      for (const s of subs) await Subcategory.create({ categoryId: c.id, name: s });
    }

    // goals
    const goals = JSON.parse(fs.readFileSync(path.join(__dirname, "goals.json")));
    for (const g of goals) await Goal.create({ name: g });

    console.log("✅ Seeded categories, subcategories, goals");
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
})();
