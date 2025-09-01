// src/controllers/profile.controller.js
const {
  User, Profile, UserCategory, UserSubcategory, UserGoal, Category, Subcategory, Goal
} = require("../models");
const { computeProfileProgress } = require("../utils/profileProgress");

// GET /api/profile/me
async function ensureProfile(userId) {
  let profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    profile = await Profile.create({
      userId,
      onboardingProfileTypeDone: false,
      onboardingCategoriesDone:  false,
      onboardingGoalsDone:       false,
      // optional defaults
      primaryIdentity: null,
      categoryId: null,
      subcategoryId: null,
      birthDate: null,
      professionalTitle: null,
      about: null,
      avatarUrl: null,
      experienceLevel: null,
      skills: [],
      languages: [],
    });
  }
  return profile;
}

async function getMe(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const user = await User.findByPk(userId, {
      attributes: [
        "id","name","email","phone",
        "country","countryOfResidence","city","accountType","nationality"
      ],
    });
    if (!user) return res.status(401).json({ message: "User not found" });

    const profile = await ensureProfile(userId);

    const [catRows, subRows, goalRows] = await Promise.all([
      UserCategory.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategory.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserGoal.findAll({ where: { userId }, attributes: ["goalId"] }),
    ]);

    const counts = {
      categories:   catRows.length,
      subcategories: subRows.length,
      goals:         goalRows.length,
    };
    const progress = computeProfileProgress({ user, profile, counts });

    return res.json({
      user,
      profile,
      counts,
      selectedCategoryIds:    catRows.map(r => r.categoryId),
      selectedSubcategoryIds: subRows.map(r => r.subcategoryId),
      selectedGoalIds:        goalRows.map(r => r.goalId),
      progress,
    });
  } catch (e) { next(e); }
}

// PUT /api/profile/personal
// Writes to User (name, phone, nationality, country, city) and Profile (birthDate, professionalTitle, about, avatarUrl)

// src/controllers/profile.controller.js
async function updatePersonal(req, res, next) {
  try {
    const userId = req.user.sub;
    const {
      name, phone, nationality, country, countryOfResidence, city, // 🆕 added countryOfResidence
      birthDate, professionalTitle, about, avatarUrl
    } = req.body;

    const [user, profile] = await Promise.all([
      User.findByPk(userId),
      Profile.findOne({ where: { userId } }),
    ]);
    if (!user || !profile) return res.status(404).json({ message: "Profile not found" });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (nationality !== undefined) user.nationality = nationality;
    if (country !== undefined) user.country = country;
    if (countryOfResidence !== undefined) user.countryOfResidence = countryOfResidence; // 🆕
    if (city !== undefined) user.city = city;
    await user.save();

    if (birthDate !== undefined) profile.birthDate = birthDate || null;
    if (professionalTitle !== undefined) profile.professionalTitle = professionalTitle || null;
    if (about !== undefined) profile.about = about || null;
    if (avatarUrl !== undefined) profile.avatarUrl = avatarUrl || null;

    await profile.save();
    return getMe(req, res, next);
  } catch (e) { next(e); }
}


// PUT /api/profile/professional
// Updates Profile (experienceLevel, skills, languages) and optional featured category/subcategory + M2M selections
async function updateProfessional(req, res, next) {
  try {
    const userId = req.user.sub;
    const {
      experienceLevel,
      skills = [],
      languages = [],
      // optional featured
      categoryId,
      subcategoryId,
      // optional full selections (M2M)
      categoryIds = [],
      subcategoryIds = [],
    } = req.body;

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.experienceLevel = experienceLevel || null;
    profile.skills    = Array.isArray(skills) ? skills.slice(0, 50) : [];
    profile.languages = Array.isArray(languages) ? languages.slice(0, 20) : [];
    // featured
    if (categoryId !== undefined)    profile.categoryId = categoryId || null;
    if (subcategoryId !== undefined) profile.subcategoryId = subcategoryId || null;
    await profile.save();

    // Multi-select industry
    if (Array.isArray(categoryIds)) {
      await UserCategory.destroy({ where: { userId } });
      for (const cid of categoryIds) await UserCategory.create({ userId, categoryId: cid });
    }
    if (Array.isArray(subcategoryIds)) {
      await UserSubcategory.destroy({ where: { userId } });
      for (const sid of subcategoryIds) await UserSubcategory.create({ userId, subcategoryId: sid });
    }

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

// PUT /api/profile/interests
// Saves selected goals (max 3)
async function updateInterests(req, res, next) {
  try {
    const userId = req.user.sub;
    const { goalIds = [] } = req.body;

    await UserGoal.destroy({ where: { userId } });
    for (const gid of goalIds.slice(0, 3)) {
      await UserGoal.create({ userId, goalId: gid });
    }

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

// PUT /api/profile/identity
// Primary identity + onboarding flag
async function updateIdentity(req, res, next) {
  try {
    const userId = req.user.sub;
    const { primaryIdentity } = req.body; // MUST be one of the ENUM values

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.primaryIdentity = primaryIdentity || null;
    profile.onboardingProfileTypeDone = !!primaryIdentity;
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

module.exports = {
  getMe,
  updatePersonal,
  updateProfessional,
  updateInterests,
  updateIdentity,
};
