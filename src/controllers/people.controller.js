const { Op } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
  UserGoal,
} = require("../models");

function like(v) {
  return { [Op.like]: `%${v}%` };
}

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [val];
}

exports.searchPeople = async (req, res) => {
  try {
    const {
      q,
      country,
      city,
      categoryId,
      cats, // múltiplas categorias (comma-separated)
      subcategoryId,
      goalId,
      limit = 20,
      offset = 0,
    } = req.query;

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;

    const currentUserId = req.user?.id || null;

    // Carrega preferências do user logado (para priorização)
    let myCategoryIds = [];
    let mySubcategoryIds = [];
    let myGoalIds = [];
    let myCountry = null;
    let myCity = null;

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city"],
        include: [
          { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          { model: Goal, as: "goals", attributes: ["id"] },
        ],
      });
      if (me) {
        myCountry = me.country || null;
        myCity = me.city || null;
        myCategoryIds = (me.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
        mySubcategoryIds = (me.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);
        myGoalIds = (me.goals || []).map((g) => String(g.id)).filter(Boolean);
      }
    }

    // Filtros de interesse vindos do cliente
    const catsList = ensureArray(cats);
    const effCategoryIds = ensureArray(categoryId).concat(catsList).filter(Boolean);
    const effSubcategoryIds = ensureArray(subcategoryId).filter(Boolean);
    const effGoalIds = ensureArray(goalId).filter(Boolean);

    // WHERE base: não mostrar admin e nem o próprio usuário
    const whereUser = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };
    if (country) whereUser.country = country;
    if (city) whereUser.city = like(city);

    if (q) {
      whereUser[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    // include interests
    const interestsWhere = {};
    if (effCategoryIds.length) interestsWhere.categoryId = { [Op.in]: effCategoryIds };
    if (effSubcategoryIds.length) interestsWhere.subcategoryId = { [Op.in]: effSubcategoryIds };

    const goalsWhere = {};
    if (effGoalIds.length) goalsWhere.id = { [Op.in]: effGoalIds };

    // Se o cliente passou algum filtro de interesse/goal, tornamos required para filtrar;
    // se não passou, deixamos livre (priorização depois).
    const interestsInclude = {
      model: UserCategory,
      as: "interests",
      required: !!(effCategoryIds.length || effSubcategoryIds.length),
      where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
      include: [
        { model: Category, as: "category", required: false },
        { model: Subcategory, as: "subcategory", required: false },
      ],
    };

    const goalsInclude = {
      model: Goal,
      as: "goals",
      required: !!effGoalIds.length,
      where: Object.keys(goalsWhere).length ? goalsWhere : undefined,
      through: { attributes: [] },
    };

    // Buscamos mais que o limit para poder aplicar a priorização e depois paginar
    const fetchLimit = lim * 3 + off;

    const rows = await User.findAll({
      where: whereUser,
      include: [
        { model: Profile, as: "profile", required: false },
        interestsInclude,
        goalsInclude,
      ],
      order: [["createdAt", "DESC"]],
      limit: fetchLimit,
    });

    // Scoring para priorização quando NÃO há filtros explícitos:
    //  - goal em comum: +100 cada
    //  - categoria em comum: +10 cada
    //  - subcategoria em comum: +5 cada
    //  - mesmo país: +2
    //  - mesma cidade (prefix match): +3
    const hasExplicitFilter =
      !!(effGoalIds.length || effCategoryIds.length || effSubcategoryIds.length || country || city || q);

    const scored = rows.map((u) => {
      const userGoalIds = (u.goals || []).map((g) => String(g.id));
      const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
      const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);

      let score = 0;
      if (currentUserId && !hasExplicitFilter) {
        const sharedGoals = userGoalIds.filter((g) => myGoalIds.includes(g)).length;
        const sharedCats = userCats.filter((c) => myCategoryIds.includes(c)).length;
        const sharedSubs = userSubs.filter((s) => mySubcategoryIds.includes(s)).length;

        score += sharedGoals * 100;
        score += sharedCats * 10;
        score += sharedSubs * 5;

        if (myCountry && u.country && String(myCountry) === String(u.country)) score += 2;
        if (
          myCity &&
          u.city &&
          String(u.city).toLowerCase().startsWith(String(myCity).toLowerCase())
        )
          score += 3;
      }

      // lookingFor/tag = goals do usuário, separados por vírgula
      const goalNames = (u.goals || []).map((g) => g.name).filter(Boolean);
      const catsOut = (u.interests || [])
        .map((i) => i.category?.name)
        .filter(Boolean);
      const subsOut = (u.interests || [])
        .map((i) => i.subcategory?.name)
        .filter(Boolean);

      return {
        raw: u,
        score,
        out: {
          id: u.id,
          name: u.name,
          role: u.profile?.professionalTitle || null,
          city: u.city || null,
          country: u.country || null,
          avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
          email: u.email,
          lookingFor: goalNames.join(", "),
          goals: goalNames,
          cats: catsOut,
          about: u.profile?.about|| null,
          subcats: subsOut,
          createdAt: u.createdAt,
        },
      };
    });

    // Ordenação: se teve filtro explícito, manter createdAt desc;
    // senão, ordenar por score desc e em seguida createdAt desc
    let ordered;
    if (hasExplicitFilter) {
      ordered = scored.sort((a, b) => new Date(b.raw.createdAt) - new Date(a.raw.createdAt));
    } else {
      ordered = scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
      });
    }

    const windowed = ordered.slice(off, off + lim).map((x) => x.out);

    res.json({
      count: ordered.length,
      items: windowed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to search people" });
  }
};
