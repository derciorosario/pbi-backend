const fs = require("fs");
const path = require("path");
const {
  Category,
  Subcategory,
  SubsubCategory,
  Goal,
  Identity,
} = require("../models");

exports.getIdentityCatalog = async (_req, res) => {
  try {
    // Load the single JSON blueprint that organizes identities → categories for UI
    const file = path.join(__dirname, "../../seed/identity_category_map.json");
    const blueprint = JSON.parse(fs.readFileSync(file, "utf8"));

    // Load canonical taxonomy from DB
    const cats = await Category.findAll({
      attributes: ["id", "name"],
      include: [
        {
          model: Subcategory,
          as: "subcategories",
          attributes: ["id", "name", "categoryId"],
        },
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
    const identities = await Promise.all(
      (blueprint.identities || []).map(async (identity) => {
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

        // Agora sim: buscar a identity no banco corretamente
        const identityRow = await Identity.findOne({
          where: { name: identity.name.trim() },
        });

        return {
          name: identity.name,
          id: identityRow ? identityRow.id : null,
          categories,
        };
      })
    );

    // ✅ Return goals WITH ids (from DB)
    const goalsDb = await Goal.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    const goals = goalsDb.map((g) => ({ id: g.id, name: g.name }));

    res.json({ identities, goals });
  } catch (err) {
    console.error("❌ Error in getIdentityCatalog:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
