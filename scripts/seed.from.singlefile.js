require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  sequelize,
  Identity,
  Goal,
  Category,
  Subcategory,
  SubsubCategory,
} = require("../src/models");

const norm = (s) => String(s || "").trim();

async function findOrCreateCategoryByName(name) {
  const n = norm(name);
  let cat = await Category.findOne({ where: { name: n } });
  if (!cat) cat = await Category.create({ name: n });
  return cat;
}
async function findOrCreateSubcategory(categoryId, name) {
  const n = norm(name);
  let sub = await Subcategory.findOne({ where: { categoryId, name: n } });
  if (!sub) sub = await Subcategory.create({ categoryId, name: n });
  return sub;
}
async function findOrCreateSubsub(subcategoryId, name) {
  const n = norm(name);
  let ss = await SubsubCategory.findOne({ where: { subcategoryId, name: n } });
  if (!ss) ss = await SubsubCategory.create({ subcategoryId, name: n });
  return ss;
}

async function seedFromSingleFile() {
  const file = path.join(__dirname, "../seed/identity_category_map.json");
  const dataset = JSON.parse(fs.readFileSync(file, "utf8"));

  // Goals
  for (const g of dataset.goals || []) {
    const name = norm(g);
    if (!name) continue;
    await Goal.findOrCreate({ where: { name }, defaults: { name } });
  }

  // Identities + canonical taxonomy
  for (const identity of dataset.identities || []) {
    const name = norm(identity.name);
    if (name) {
      await Identity.findOrCreate({ where: { name }, defaults: { name } });
    }

    for (const cat of identity.categories || []) {
      const catRow = await findOrCreateCategoryByName(cat.name);

      for (const sub of cat.subcategories || []) {
        const subRow = await findOrCreateSubcategory(catRow.id, sub.name);
        for (const ssName of sub.subsubs || []) {
          await findOrCreateSubsub(subRow.id, ssName);
        }
      }
    }
  }

  console.log("✅ Seeded identities + goals + canonical taxonomy.");
}

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await seedFromSingleFile();
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  }
})();
