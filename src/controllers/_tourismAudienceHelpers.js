// controllers/_tourismAudienceHelpers.js
const { Op } = require("sequelize");
const { Identity, Category, Subcategory, SubsubCategory } = require("../models");

function toIdArray(maybeArray) {
  if (maybeArray == null || maybeArray === "") return [];
  if (Array.isArray(maybeArray)) return [...new Set(maybeArray.map(String))];
  if (typeof maybeArray === "string") {
    return [...new Set(maybeArray.split(",").map(s => s.trim()).filter(Boolean))];
  }
  return [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ensure all entries are identity UUIDs.
 * If any string isn't a UUID, try to resolve it by Identity.name. */
async function normalizeIdentityIds(idsOrNames) {
  if (!idsOrNames?.length) return [];
  const ids = [];
  const names = [];
  for (const v of idsOrNames) {
    if (UUID_RE.test(v)) ids.push(v);
    else names.push(v);
  }
  if (names.length) {
    const found = await Identity.findAll({
      where: { name: { [Op.in]: names } },
      attributes: ["id", "name"],
      raw: true,
    });
    const byName = new Map(found.map(r => [r.name, r.id]));
    const missing = names.filter(n => !byName.has(n));
    if (missing.length) {
      throw new Error(`Unknown identities: ${missing.join(", ")}`);
    }
    ids.push(...names.map(n => byName.get(n)));
  }
  return [...new Set(ids)];
}

async function validateAudienceHierarchy({ categoryIds, subcategoryIds, subsubCategoryIds }) {
  if (subcategoryIds.length && categoryIds.length) {
    const subcats = await Subcategory.findAll({
      where: { id: { [Op.in]: subcategoryIds } },
      attributes: ["id", "categoryId"],
      raw: true,
    });
    const allowed = new Set(categoryIds.map(String));
    const bad = subcats.filter(sc => !allowed.has(String(sc.categoryId)));
    if (bad.length) {
      throw new Error("Some subcategories do not belong to the selected categories.");
    }
  }

  if (subsubCategoryIds.length) {
    const subsubs = await SubsubCategory.findAll({
      where: { id: { [Op.in]: subsubCategoryIds } },
      attributes: ["id", "subcategoryId"],
      raw: true,
    });
    // Only validate against provided subcats if we have them
    if (subcategoryIds.length) {
      const allowedSubs = new Set(subcategoryIds.map(String));
      const bad = subsubs.filter(s => !allowedSubs.has(String(s.subcategoryId)));
      if (bad.length) {
        throw new Error("Some sub-subcategories do not belong to the selected subcategories.");
      }
    }
  }

  if (categoryIds.length) {
    const n = await Category.count({ where: { id: { [Op.in]: categoryIds } } });
    if (n !== categoryIds.length) throw new Error("Some categories do not exist.");
  }
  if (subcategoryIds.length) {
    const n = await Subcategory.count({ where: { id: { [Op.in]: subcategoryIds } } });
    if (n !== subcategoryIds.length) throw new Error("Some subcategories do not exist.");
  }
  if (subsubCategoryIds.length) {
    const n = await SubsubCategory.count({ where: { id: { [Op.in]: subsubCategoryIds } } });
    if (n !== subsubCategoryIds.length) throw new Error("Some sub-subcategories do not exist.");
  }
}

async function setTourismAudience(tourism, { identityIds, categoryIds, subcategoryIds, subsubCategoryIds }) {
  console.log({ identityIds, categoryIds, subcategoryIds, subsubCategoryIds });
  if (identityIds)        await tourism.setAudienceIdentities(identityIds);
  if (categoryIds)        await tourism.setAudienceCategories(categoryIds);
  if (subcategoryIds)     await tourism.setAudienceSubcategories(subcategoryIds);
  if (subsubCategoryIds)  await tourism.setAudienceSubsubs(subsubCategoryIds);
}

module.exports = {
  toIdArray,
  normalizeIdentityIds,
  validateAudienceHierarchy,
  setTourismAudience,
};