// seedGeneralCategories.js
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const {  GeneralCategory, GeneralSubcategory, GeneralSubsubCategory } = require("../src/models"); // adjust path

async function seed() {
  const categoriesPath = path.join(__dirname, "../seed/generalCategories.json");
  const types = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  try {
    for (const t of types) {
      for (const cat of t.categories) {
        const category = await GeneralCategory.create({
          id: uuidv4(),
          name: cat.name,
          type: t.type,
        });

        // Handle mixed subcategories (strings and objects)
        if (Array.isArray(cat.subcategories)) {
          for (const sub of cat.subcategories) {
            // Handle string subcategories
            if (typeof sub === "string") {
              await GeneralSubcategory.create({
                id: uuidv4(),
                name: sub,
                generalCategoryId: category.id,
              });
            }
            // Handle object subcategories with potential subsubcategories
            else if (typeof sub === "object" && sub.name) {
              const subcategory = await GeneralSubcategory.create({
                id: uuidv4(),
                name: sub.name,
                generalCategoryId: category.id,
              });

              if (sub.subsubcategories && sub.subsubcategories.length > 0) {
                for (const subsub of sub.subsubcategories) {
                  await GeneralSubsubCategory.create({
                    id: uuidv4(),
                    name: subsub,
                    generalSubcategoryId: subcategory.id,
                  });
                }
              }
            } else if (typeof sub === "object" && !sub.name) {
              // Handle case where object doesn't have name property
              console.warn("Skipping subcategory object without name:", sub);
            }
          }
        }
      }
    }

   // console.log("✅ Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  }
}

seed();
