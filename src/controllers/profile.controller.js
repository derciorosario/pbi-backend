// src/controllers/profile.controller.js
const {
  sequelize,
  User,
  Profile,
  Identity,
  Category,
  Subcategory,
  SubsubCategory,
  // FAZ (seleções do usuário)
  UserIdentity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  // PROCURA (interesses)
  UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
} = require("../models");

const { computeProfileProgress } = require("../utils/profileProgress");

/* Utils */
function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return [...new Set(val.filter(Boolean))];
  return [val];
}

async function ensureProfile(userId) {
  let profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    profile = await Profile.create({
      userId,
      onboardingProfileTypeDone: false,
      onboardingCategoriesDone:  false,
      onboardingGoalsDone:       false,
      primaryIdentity: null, // mantemos o campo caso use como rótulo/legenda
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

/* GET /api/profile/me */
async function getMe(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const user = await User.findByPk(userId, {
      attributes: [
        "id","name","email","phone",
        "country","countryOfResidence","city","accountType","nationality","avatarUrl"
      ],
    });
    if (!user) return res.status(401).json({ message: "User not found" });

    const profile = await ensureProfile(userId);

    const [
      doIdentRows, doCatRows, doSubRows, doXRows,
      wantIdentRows, wantCatRows, wantSubRows, wantXRows,
    ] = await Promise.all([
      UserIdentity.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategory.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategory.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategory.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),

      UserIdentityInterest.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategoryInterest.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategoryInterest.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategoryInterest.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),
    ]);

    const counts = {
      categories:   doCatRows.length,
      subcategories: doSubRows.length,
      // podemos somar subsubs se quiser mostrar no progresso
      subsubs:       doXRows.length,
    };

    const progress = computeProfileProgress({ user, profile, counts });

    return res.json({
      user,
      profile,
      counts,
      // FAZ
      doIdentityIds:        doIdentRows.map(r => r.identityId),
      doCategoryIds:        doCatRows.map(r => r.categoryId),
      doSubcategoryIds:     doSubRows.map(r => r.subcategoryId),
      doSubsubCategoryIds:  doXRows.map(r => r.subsubCategoryId),

      // PROCURA
      interestIdentityIds:       wantIdentRows.map(r => r.identityId),
      interestCategoryIds:       wantCatRows.map(r => r.categoryId),
      interestSubcategoryIds:    wantSubRows.map(r => r.subcategoryId),
      interestSubsubCategoryIds: wantXRows.map(r => r.subsubCategoryId),

      progress,
    });
  } catch (e) { next(e); }
}

/* PUT /api/profile/personal */
async function updatePersonal(req, res, next) {
  try {
    const userId = req.user.sub;
    const {
      name, phone, nationality, country, countryOfResidence, city,
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
    if (countryOfResidence !== undefined) user.countryOfResidence = countryOfResidence;
    if (city !== undefined) user.city = city;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || null; // avatar principal do User
    await user.save();

    if (birthDate !== undefined) profile.birthDate = birthDate || null;
    if (professionalTitle !== undefined) profile.professionalTitle = professionalTitle || null;
    if (about !== undefined) profile.about = about || null;
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* PUT /api/profile/professional
   ATENÇÃO: agora NÃO mexe mais em categorias/identidades.
   Apenas nível, skills e languages. */
async function updateProfessional(req, res, next) {
  try {
    const userId = req.user.sub;
    const { experienceLevel, skills = [], languages = [] } = req.body;

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.experienceLevel = experienceLevel || null;
    profile.skills    = Array.isArray(skills) ? skills.slice(0, 50) : [];
    profile.languages = Array.isArray(languages) ? languages.slice(0, 20) : [];
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* Helpers de validação */
async function validateIds({ identityIds, categoryIds, subcategoryIds, subsubCategoryIds }) {
  const [
    vIdent,
    vCat,
    vSub,
    vX,
  ] = await Promise.all([
    Identity.findAll({ where: { id: arr(identityIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    Category.findAll({ where: { id: arr(categoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    Subcategory.findAll({ where: { id: arr(subcategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    SubsubCategory.findAll({ where: { id: arr(subsubCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
  ]);
  return {
    identityIds: vIdent,
    categoryIds: vCat,
    subcategoryIds: vSub,
    subsubCategoryIds: vX,
  };
}

/* PUT /api/profile/do-selections
   Atualiza o que o usuário FAZ (identidades/categorias/subs/subsubs) */
async function updateDoSelections(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.sub;
    const payload = await validateIds({
      identityIds:       req.body.identityIds,
      categoryIds:       req.body.categoryIds,
      subcategoryIds:    req.body.subcategoryIds,
      subsubCategoryIds: req.body.subsubCategoryIds,
    });

    // clear (sequencial na mesma transação)
    await UserIdentity.destroy({ where: { userId }, transaction: t });
    await UserCategory.destroy({ where: { userId }, transaction: t });
    await UserSubcategory.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategory.destroy({ where: { userId }, transaction: t });

    // create
    if (payload.identityIds.length)
      await UserIdentity.bulkCreate(payload.identityIds.map(identityId => ({ userId, identityId })), { transaction: t });

    if (payload.categoryIds.length)
      await UserCategory.bulkCreate(payload.categoryIds.map(categoryId => ({ userId, categoryId })), { transaction: t });

    if (payload.subcategoryIds.length)
      await UserSubcategory.bulkCreate(payload.subcategoryIds.map(subcategoryId => ({ userId, subcategoryId })), { transaction: t });

    if (payload.subsubCategoryIds.length)
      await UserSubsubCategory.bulkCreate(payload.subsubCategoryIds.map(subsubCategoryId => ({ userId, subsubCategoryId })), { transaction: t });

    await t.commit();
    return getMe(req, res, next);
  } catch (e) {
    try { if (!t.finished) await t.rollback(); } catch {}
    next(e);
  }
}

/* PUT /api/profile/interest-selections
   Atualiza o que o usuário PROCURA (interesses: identidades/categorias/subs/subsubs)
   Regras do produto: máx 3 identidades, máx 3 categorias.
   A API não precisa bloquear, mas vamos aplicar um clamp simples. */
async function updateInterestSelections(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.sub;

    // clamp simples (front já impõe limite, back reforça):
    const clamp3 = (xs) => arr(xs).slice(0, 3);

    const payload = await validateIds({
      identityIds:       clamp3(req.body.identityIds),
      categoryIds:       clamp3(req.body.categoryIds),
      subcategoryIds:    req.body.subcategoryIds,    // permitir N sob as categorias escolhidas
      subsubCategoryIds: req.body.subsubCategoryIds, // permitir N sob as categorias escolhidas
    });

    // clear (sequencial)
    await UserIdentityInterest.destroy({ where: { userId }, transaction: t });
    await UserCategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubcategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategoryInterest.destroy({ where: { userId }, transaction: t });

    // create
    if (payload.identityIds.length)
      await UserIdentityInterest.bulkCreate(payload.identityIds.map(identityId => ({ userId, identityId })), { transaction: t });

    if (payload.categoryIds.length)
      await UserCategoryInterest.bulkCreate(payload.categoryIds.map(categoryId => ({ userId, categoryId })), { transaction: t });

    if (payload.subcategoryIds.length)
      await UserSubcategoryInterest.bulkCreate(payload.subcategoryIds.map(subcategoryId => ({ userId, subcategoryId })), { transaction: t });

    if (payload.subsubCategoryIds.length)
      await UserSubsubCategoryInterest.bulkCreate(payload.subsubCategoryIds.map(subsubCategoryId => ({ userId, subsubCategoryId })), { transaction: t });

    await t.commit();
    return getMe(req, res, next);
  } catch (e) {
    try { if (!t.finished) await t.rollback(); } catch {}
    next(e);
  }
}

module.exports = {
  getMe,
  updatePersonal,
  updateProfessional,
  updateDoSelections,
  updateInterestSelections,
};
