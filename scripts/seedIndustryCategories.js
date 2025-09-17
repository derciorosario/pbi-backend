// scripts/seedIndustryCategories.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../src/models"); // adjust if needed

async function seed() {
  const categoriesPath = path.join(__dirname, "../seed/industryCategories.json");
  const industries = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  try {
    for (const ind of industries) {
      // 1. Create IndustryCategory
      const industry = await IndustryCategory.create({
        id: uuidv4(),
        name: ind.name,
      });

      // 2. Loop categories
      for (const cat of ind.categories) {
        const subcategory = await IndustrySubcategory.create({
          id: uuidv4(),
          name: cat.name,
          industryCategoryId: industry.id, // ✅ must exist
        });

        // 3. Loop subcategories
        if (Array.isArray(cat.subcategories)) {
          for (const sub of cat.subcategories) {
            // Create IndustrySubsubCategory directly under this subcategory
            if (Array.isArray(sub.subsubs) && sub.subsubs.length > 0) {
              for (const subsubName of sub.subsubs) {
                await IndustrySubsubCategory.create({
                  id: uuidv4(),
                  name: subsubName,
                  industrySubcategoryId: subcategory.id,
                });
              }
            } else {
              // Treat plain subcategories (without subsubs) as subsubcategories
              await IndustrySubsubCategory.create({
                id: uuidv4(),
                name: sub.name,
                industrySubcategoryId: subcategory.id,
              });
            }
          }
        }
      }
    }

    console.log("✅ Industry categories seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding industry categories:", err);
    process.exit(1);
  }
}

seed();
