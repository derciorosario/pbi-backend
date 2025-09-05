const fs = require("fs");
const path = require("path");
const {
  Category,
  Subcategory,
  SubsubCategory,
  Goal,
} = require("../models");

exports.getIdentityCatalog = async (_req, res) => {
  // Load the single JSON blueprint that organizes identities → categories for UI
  const file = path.join(__dirname, "../../seed/identity_category_map.json");
  const blueprint = JSON.parse(fs.readFileSync(file, "utf8"));

  // Load canonical taxonomy from DB
  const cats = await Category.findAll({
    attributes: ["id", "name"],
    include: [
      { model: Subcategory, as: "subcategories", attributes: ["id", "name", "categoryId"] },
    ],
    order: [["name", "ASC"]],
  });

  // Build quick lookup maps for ID resolution
  const catByName = new Map(
    cats.map((c) => [c.name.trim().toLowerCase(), c])
  );

  const subsByPair = new Map();
  for (const c of cats) {
    for (const s of c.subcategories || []) {
      subsByPair.set(
        `${c.name.trim().toLowerCase()}::${s.name.trim().toLowerCase()}`,
        s
      );
    }
  }

  const allSubsubs = await SubsubCategory.findAll({
    attributes: ["id", "name", "subcategoryId"],
  });

  const subsubsBySubIdAndName = new Map(
    allSubsubs.map((ss) => [
      `${ss.subcategoryId}::${ss.name.trim().toLowerCase()}`,
      ss,
    ])
  );

  // Map JSON blueprint → attach IDs from canonical taxonomy where possible
  const identities = (blueprint.identities || []).map((identity) => {
    const categories = (identity.categories || []).map((cat) => {
      const foundCat = catByName.get(cat.name.trim().toLowerCase()) || null;

      const subcategories = (cat.subcategories || []).map((sub) => {
        let foundSub = null;
        if (foundCat) {
          const key = `${foundCat.name.trim().toLowerCase()}::${sub.name
            .trim()
            .toLowerCase()}`;
          foundSub = subsByPair.get(key) || null;
        }

        const subsubs = (sub.subsubs || []).map((ssName) => {
          let foundSs = null;
          if (foundSub) {
            const ssKey = `${foundSub.id}::${String(ssName)
              .trim()
              .toLowerCase()}`;
            foundSs = subsubsBySubIdAndName.get(ssKey) || null;
          }
          return { id: foundSs ? foundSs.id : null, name: String(ssName) };
        });

        return {
          id: foundSub ? foundSub.id : null,
          name: sub.name,
          subsubs,
        };
      });

      return {
        id: foundCat ? foundCat.id : null,
        name: cat.name,
        subcategories,
      };
    });

    // NOTE: we are not returning identity IDs here because identities are not tied to taxonomy in DB.
    // If you later persist identities and want to select them, add their IDs to the JSON + DB and include here.
    return { name: identity.name, categories };
  });

  // ✅ Return goals WITH ids (from DB)
  const goalsDb = await Goal.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });
  const goals = goalsDb.map((g) => ({ id: g.id, name: g.name }));

  res.json({ identities, goals });
};
