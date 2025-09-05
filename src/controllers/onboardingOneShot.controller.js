const {
  sequelize,
  User,
  Profile,
  Identity,
  Goal,
  Category,
  Subcategory,
  SubsubCategory,
  UserIdentity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  UserGoal,
} = require("../models");

// Helper to normalize & uniq arrays
function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return [...new Set(val.filter(Boolean))];
  return [val];
}

exports.saveOneShot = async (req, res) => {
  const userId = req.user?.id || req.user?.sub; // whichever you're using
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const {
    identityIds = [],         // optional (array of identity IDs)
    categoryIds = [],         // optional (array of category IDs)
    subcategoryIds = [],      // optional (array of subcategory IDs)
    subsubCategoryIds = [],   // optional (array of subsub IDs)
    goalIds = [],             // optional (array of goal IDs)
  } = req.body || {};

  const t = await sequelize.transaction();
  try {
    // Validate existence (ignore invalids gracefully)
    const validIdentityIds = (await Identity.findAll({ where: { id: arr(identityIds) }, attributes: ["id"] })).map(r => r.id);
    const validCategoryIds  = (await Category.findAll({ where: { id: arr(categoryIds) }, attributes: ["id"] })).map(r => r.id);
    const validSubcatIds    = (await Subcategory.findAll({ where: { id: arr(subcategoryIds) }, attributes: ["id"] })).map(r => r.id);
    const validSubsubIds    = (await SubsubCategory.findAll({ where: { id: arr(subsubCategoryIds) }, attributes: ["id"] })).map(r => r.id);
    const validGoalIds      = (await Goal.findAll({ where: { id: arr(goalIds) }, attributes: ["id"] })).map(r => r.id);

    // Replace selections idempotently
    await Promise.all([
      UserIdentity.destroy({ where: { userId }, transaction: t }),
      UserCategory.destroy({ where: { userId }, transaction: t }),
      UserSubcategory.destroy({ where: { userId }, transaction: t }),
      UserSubsubCategory.destroy({ where: { userId }, transaction: t }),
      UserGoal.destroy({ where: { userId }, transaction: t }),
    ]);

    await Promise.all([
      ...validIdentityIds.map(identityId =>
        UserIdentity.create({ userId, identityId }, { transaction: t })
      ),
      ...validCategoryIds.map(categoryId =>
        UserCategory.create({ userId, categoryId }, { transaction: t })
      ),
      ...validSubcatIds.map(subcategoryId =>
        UserSubcategory.create({ userId, subcategoryId }, { transaction: t })
      ),
      ...validSubsubIds.map(subsubCategoryId =>
        UserSubsubCategory.create({ userId, subsubCategoryId }, { transaction: t })
      ),
      ...validGoalIds.map(goalId =>
        UserGoal.create({ userId, goalId }, { transaction: t })
      ),
    ]);

    // Mark onboardingDone = true
    const prof = await Profile.findOne({ where: { userId }, transaction: t });
    if (prof) {
      prof.onboardingDone = true;
      prof.onboardingProfileTypeDone = true;
      prof.onboardingCategoriesDone  = true;
      prof.onboardingGoalsDone       = true;
      await prof.save({ transaction: t });
    }

    await t.commit();
    return res.json({
      ok: true,
      saved: {
        identityIds: validIdentityIds,
        categoryIds: validCategoryIds,
        subcategoryIds: validSubcatIds,
        subsubCategoryIds: validSubsubIds,
        goalIds: validGoalIds,
      },
    });
  } catch (e) {
    await t.rollback();
    console.error(e);
    return res.status(500).json({ message: "Failed to save onboarding data" });
  }
};
