const { User, Profile, Category, Subcategory, Goal,
        UserCategory, UserSubcategory, UserGoal } = require("../models");

async function getState(userId) {
  const profile = await Profile.findOne({ where: { userId } });

  const [catsCount, subsCount, goalsCount] = await Promise.all([
    UserCategory.count({ where: { userId } }),
    UserSubcategory.count({ where: { userId } }),
    UserGoal.count({ where: { userId } }),
  ]);

  const profileTypeDone = Boolean(profile?.primaryIdentity);
  const categoriesDone  = catsCount >= 1 && subsCount >= 2; // rule
  const goalsDone       = goalsCount >= 1;                  // at least 1, cap enforced at 3 elsewhere

  let nextStep = null;
  if (!profileTypeDone) nextStep = "profileType";
  else if (!categoriesDone) nextStep = "industry";
  else if (!goalsDone) nextStep = "goals";

  return {
    profileTypeDone, categoriesDone, goalsDone, nextStep,
    progress: Math.round(((profileTypeDone + categoriesDone + goalsDone) / 3) * 100),
  };
}

async function setProfileType(userId, primaryIdentity) {
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) throw Object.assign(new Error("Profile not found"), { status: 404 });
  profile.primaryIdentity = primaryIdentity;
  await profile.save();
  return getState(userId);
}

async function setCategories(userId, categoryIds = [], subcategoryIds = []) {
  // validate categories / subs exist
  const [cats, subs] = await Promise.all([
    Category.findAll({ where: { id: categoryIds } }),
    Subcategory.findAll({ where: { id: subcategoryIds } }),
  ]);
  if (cats.length < 1)  throw Object.assign(new Error("At least 1 industry category required"), { status: 400 });
  if (subs.length < 1)  throw Object.assign(new Error("Select at least 1 subcategories"), { status: 400 });

  // replace selections (idempotent)
  await UserCategory.destroy({ where: { userId } });
  await UserSubcategory.destroy({ where: { userId } });
  await Promise.all([
    ...categoryIds.map(categoryId => UserCategory.create({ userId, categoryId })),
    ...subcategoryIds.map(subcategoryId => UserSubcategory.create({ userId, subcategoryId })),
  ]);

  return getState(userId);
}

async function setGoals(userId, goalIds = []) {
  if (goalIds.length === 0 || goalIds.length > 3) {
    throw Object.assign(new Error("Choose between 1 and 3 goals"), { status: 400 });
  }
  // validate exist
  const found = await Goal.findAll({ where: { id: goalIds } });
  if (found.length !== goalIds.length) throw Object.assign(new Error("Invalid goals"), { status: 400 });

  await UserGoal.destroy({ where: { userId } });
  await Promise.all(goalIds.map(goalId => UserGoal.create({ userId, goalId })));

  return getState(userId);
}

module.exports = { getState, setProfileType, setCategories, setGoals };
