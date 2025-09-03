// src/controllers/feed.controller.js
const { Op } = require("sequelize");
const { Job, Event, Category, Subcategory, User, Profile, UserCategory,
  Goal } = require("../models");



exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    include: [{ model: Subcategory, as: "subcategories" }],
    order: [["name", "ASC"], [{ model: Subcategory, as: "subcategories" }, "name", "ASC"]],
  });

  const countries = [
    "Angola","Ghana","Nigeria","Kenya","South Africa","Mozambique","Tanzania","Uganda","Zimbabwe","Zambia",
    "Namibia","Cameroon","Senegal","Ivory Coast","Rwanda","Ethiopia","Morocco","Egypt","Sudan"
  ];

  res.json({
    categories: categories.map(c => ({
      id: String(c.id),
      name: c.name,
      subcategories: (c.subcategories || []).map(s => ({ id: String(s.id), name: s.name })),
    })),
    countries
  });
};


const like = (v) => ({ [Op.like]: `%${v}%` });
const pickNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---- Humanizer: "Just now", "1 min ago", "2 hours ago", "3 days ago" ----
function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000; // seconds

  if (diff < 45) return "Just now";
  if (diff < 90) return "1 min ago";

  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  // fallback simples: data local
  return d.toLocaleDateString();
}

// Includes comuns para trazer nomes de categoria/subcategoria
const includeCategoryRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
];

exports.getFeed = async (req, res) => {
  try {
    const {
      tab,
      q,
      country,
      city,
      categoryId,
      subcategoryId,
      limit = 20,
      offset = 0,
    } = req.query;

    const lim = pickNumber(limit) ?? 20;
    const off = pickNumber(offset) ?? 0;

    const isFilterActive = Boolean(
      q || country || city || categoryId || subcategoryId
    );
    const currentUserId = req.user?.id || null;

    // ---------------- 1) Defaults do usuário (para priorização quando NÃO há filtros) ----------------
    let userDefaults = {
      country: null,
      city: null,
      categoryIds: [],
      subcategoryIds: [],
    };

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city", "accountType"],
        include: [
          {
            model: Profile,
            as: "profile",
            attributes: ["categoryId", "subcategoryId"],
            required: false,
          },
          {
            model: UserCategory,
            as: "interests",
            attributes: ["categoryId", "subcategoryId"],
          },
        ],
      });

      if (me) {
        userDefaults.country = me.country || null;
        userDefaults.city = me.city || null;

        const interestCats = (me.interests || [])
          .map((i) => i.categoryId)
          .filter(Boolean);
        const interestSubs = (me.interests || [])
          .map((i) => i.subcategoryId)
          .filter(Boolean);

        if (me.profile?.categoryId) interestCats.push(me.profile.categoryId);
        if (me.profile?.subcategoryId) interestSubs.push(me.profile.subcategoryId);

        userDefaults.categoryIds = Array.from(new Set(interestCats));
        userDefaults.subcategoryIds = Array.from(new Set(interestSubs));
      }
    }

    // ---------------- 2) WHEREs com base somente nos FILTROS (quando existirem) ----------------
    const whereCommon = {};
    if (country) whereCommon.country = country;
    if (city) whereCommon.city = like(city);

    const whereJob = { ...whereCommon };
    const whereEvent = { ...whereCommon };

    if (categoryId) {
      whereJob.categoryId = categoryId;
      whereEvent.categoryId = categoryId;
    }
    if (subcategoryId) {
      whereJob.subcategoryId = subcategoryId;
      whereEvent.subcategoryId = subcategoryId;
    }

    if (q) {
      whereJob[Op.or] = [
        { title: like(q) },
        { companyName: like(q) },
        { city: like(q) },
      ];
      whereEvent[Op.or] = [
        { title: like(q) },
        { description: like(q) },
        { city: like(q) },
      ];
    }

    // ---------------- 3) Mapeadores com nomes + timeAgo ----------------
    const mapJob = (j) => ({
      kind: "job",
      id: j.id,
      title: j.title,
      companyName: j.companyName,
      jobType: j.jobType,
      workMode: j.workMode,
      categoryId: j.categoryId ? String(j.categoryId) : "",
      categoryName: j.category?.name || "",
      subcategoryId: j.subcategoryId ? String(j.subcategoryId) : "",
      subcategoryName: j.subcategory?.name || "",
      description: j.description,
      city: j.city,
      country: j.country,
      currency: j.currency,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      createdAt: j.createdAt,
      timeAgo: timeAgo(j.createdAt),
    });

    const mapEvent = (e) => ({
      kind: "event",
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      description: e.description,
      coverImageBase64: e.coverImageBase64,
      isPaid: e.isPaid,
      price: e.price,
      currency: e.currency,
      categoryId: e.categoryId ? String(e.categoryId) : "",
      categoryName: e.category?.name || "",
      subcategoryId: e.subcategoryId ? String(e.subcategoryId) : "",
      subcategoryName: e.subcategory?.name || "",
      city: e.city,
      country: e.country,
      createdAt: e.createdAt,
      timeAgo: timeAgo(e.createdAt),
    });

    // ---------------- 4) Scoring para priorização (quando há usuário e NÃO há filtro) ----------------
    const userCatSet = new Set(userDefaults.categoryIds || []);
    const userSubSet = new Set(userDefaults.subcategoryIds || []);
    const userCity = (userDefaults.city || "").toLowerCase();
    const userCountry = userDefaults.country || null;

    const scoreItem = (x) => {
      let s = 0;
      if (x.subcategoryId && userSubSet.has(x.subcategoryId)) s += 4;
      else if (x.categoryId && userCatSet.has(x.categoryId)) s += 3;

      if (userCity && x.city && x.city.toLowerCase() === userCity) s += 2;
      if (userCountry && x.country === userCountry) s += 1;
      return s;
    };

    // ---------------- 5) Fluxos por aba e por situação (filtros x priorização) ----------------

    // (A) Há filtros OU não há usuário -> usar somente filtros
    if (isFilterActive || !currentUserId) {
      if (tab === "events") {
        const events = await Event.findAll({
          where: whereEvent,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: events.map(mapEvent) });
      }

      if (tab === "jobs") {
        const jobs = await Job.findAll({
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: jobs.map(mapJob) });
      }

      // “All”
      const [jobsAll, eventsAll] = await Promise.all([
        Job.findAll({
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Event.findAll({
          where: whereEvent,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
      ]);

      const merged = [
        ...jobsAll.map(mapJob),
        ...eventsAll.map(mapEvent),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const windowed = merged.slice(off, off + lim);
      return res.json({ items: windowed });
    }

    // (B) Não há filtros e há usuário -> priorização (score)
    const bufferFactor = 3;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = events
        .map(mapEvent)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: windowed });
    }

    if (tab === "jobs") {
      const jobs = await Job.findAll({
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = jobs
        .map(mapJob)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: windowed });
    }

    // “All” com priorização
    const [jobsBuf, eventsBuf] = await Promise.all([
      Job.findAll({ include: includeCategoryRefs, order: [["createdAt", "DESC"]], limit: bufferLimit }),
      Event.findAll({ include: includeCategoryRefs, order: [["createdAt", "DESC"]], limit: bufferLimit }),
    ]);

    const mergedScored = [
      ...jobsBuf.map(mapJob),
      ...eventsBuf.map(mapEvent),
    ].map((x) => ({ ...x, _score: scoreItem(x) }));


    
    mergedScored.sort(
      (a, b) =>
        b._score - a._score ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const windowed = mergedScored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
    return res.json({ items: windowed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get feed" });
  }
};


/*
exports.getSuggestions = async (req, res) => {
const like = (v) => ({ [Op.like]: `%${v}%` });
  try {
    const {
      q,
      country: qCountry,
      city: qCity,
      categoryId: qCategoryId,
      subcategoryId: qSubcategoryId,
      limit = 10,
    } = req.query;

    const currentUserId = req.user?.id || null;

    // ---------- 1) Carrega preferências do usuário (se logado) ----------
    let userDefaults = {
      country: null,
      city: null,
      categoryIds: [],
      subcategoryIds: [],
    };

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city", "accountType"],
        include: [
          {
            model: UserCategory,
            as: "interests",
            attributes: ["categoryId", "subcategoryId"],
          },
        ],
      });

      if (me) {
        userDefaults.country = me.country || null;
        userDefaults.city = me.city || null;
        userDefaults.categoryIds = (me.interests || [])
          .map((i) => i.categoryId)
          .filter(Boolean);
        userDefaults.subcategoryIds = (me.interests || [])
          .map((i) => i.subcategoryId)
          .filter(Boolean);
      }
    }

    // ---------- 2) Filtros efetivos (prioriza query > defaults do usuário) ----------
    const eff = {
      country: qCountry ?? userDefaults.country ?? null,
      city: qCity ?? userDefaults.city ?? null,
      categoryIds: qCategoryId
        ? [qCategoryId]
        : userDefaults.categoryIds.length
        ? userDefaults.categoryIds
        : null,
      subcategoryIds: qSubcategoryId
        ? [qSubcategoryId]
        : userDefaults.subcategoryIds.length
        ? userDefaults.subcategoryIds
        : null,
    };

    // ---------- 3) Guards base (excluir admin e o próprio usuário) ----------
    const baseUserGuards = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };

    // ---------- 4) WHERE do usuário para MATCHES ----------
    const whereUser = { ...baseUserGuards };
    if (eff.country) whereUser.country = eff.country;
    if (eff.city) whereUser.city = like(eff.city);

    if (q) {
      whereUser[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const interestsWhere = {};
    if (eff.categoryIds) interestsWhere.categoryId = { [Op.in]: eff.categoryIds };
    if (eff.subcategoryIds) interestsWhere.subcategoryId = { [Op.in]: eff.subcategoryIds };

    // include de interesses só vira "required" se houver filtro efetivo de interesse
    const interestsIncludeForMatches = {
      model: UserCategory,
      as: "interests",
      required: !!(eff.categoryIds || eff.subcategoryIds),
      where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
      include: [
        { model: Category, as: "category", required: false },
        { model: Subcategory, as: "subcategory", required: false },
      ],
    };

    // ---------- 5) MATCHES ----------
    const matchesRaw = await User.findAll({
      where: whereUser,
      include: [
        { model: Profile, as: "profile", required: false },
        interestsIncludeForMatches,
      ],
      limit: Number(limit),
      order: [["createdAt", "DESC"]],
    });

    const matches = matchesRaw.map((u, idx) => {
      const firstInterest = (u.interests || [])[0];
      const lookingFor =
        firstInterest?.subcategory?.name ||
        firstInterest?.category?.name ||
        null;

      return {
        id: u.id,
        name: u.name,
        role: u.profile?.professionalTitle || null,
        tag: lookingFor,
        avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
        city: u.city || null,
        country: u.country || null,
        email: u.email,
        mockIndex: 30 + idx, // útil para pravatar se você usa
      };
    });

    // ---------- 6) NEARBY ----------
    // Baseado em localização efetiva; não exige interesse (para ser mais "amplo"),
    // mas ainda respeita filtros de q/categoria se vieram.
    const nearbyWhere = { ...baseUserGuards };
    if (eff.city) nearbyWhere.city = like(eff.city);
    else if (eff.country) nearbyWhere.country = eff.country;

    if (q) {
      nearbyWhere[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const interestsIncludeForNearby =
      eff.categoryIds || eff.subcategoryIds
        ? {
            model: UserCategory,
            as: "interests",
            required: true, // se o cliente filtrou por interesse, "nearby" também respeita
            where: interestsWhere,
            include: [
              { model: Category, as: "category", required: false },
              { model: Subcategory, as: "subcategory", required: false },
            ],
          }
        : { model: UserCategory, as: "interests", required: false };

    const nearbyRaw = await User.findAll({
      where: nearbyWhere,
      include: [
        { model: Profile, as: "profile", required: false },
        interestsIncludeForNearby,
      ],
      limit: Number(limit),
      order: [["createdAt", "DESC"]],
    });

    const nearby = nearbyRaw.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.profile?.professionalTitle || null,
      city: u.city || null,
      country: u.country || null,
      avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
      email: u.email,
    }));

    res.json({
      matchesCount: matches.length,
      nearbyCount: nearby.length,
      matches,
      nearby,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
};


*/

function normalizeToArray(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [v];
}

exports.getSuggestions = async (req, res) => {
  try {
    const {
      q,
      country: qCountry,
      city: qCity,
      // agora aceitamos tanto categoryId quanto cats
      categoryId,        // pode ser único ou CSV
      cats,              // pode ser único ou CSV
      subcategoryId,     // pode ser único ou CSV
      goalId,            // único ou CSV (também aceito)
      limit = 10,
    } = req.query;

    
const like = (v) => ({ [Op.like]: `%${v}%` });

    const currentUserId = req.user?.id || null;

    // ===== 1) Defaults do usuário logado =====
    let userDefaults = {
      country: null,
      city: null,
      categoryIds: [],
      subcategoryIds: [],
      goalIds: [],
    };

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city", "accountType"],
        include: [
          { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          { model: Goal, as: "goals", attributes: ["id", "name"], through: { attributes: [] } },
        ],
      });
      if (me) {
        userDefaults.country = me.country || null;
        userDefaults.city = me.city || null;
        userDefaults.categoryIds = (me.interests || []).map(i => i.categoryId).filter(Boolean);
        userDefaults.subcategoryIds = (me.interests || []).map(i => i.subcategoryId).filter(Boolean);
        userDefaults.goalIds = (me.goals || []).map(g => String(g.id)).filter(Boolean);
      }
    }

    // ===== 2) Filtros efetivos (prioriza query) =====
    const qCats = normalizeToArray(cats) || normalizeToArray(categoryId);
    const qSubcats = normalizeToArray(subcategoryId);
    const qGoals = normalizeToArray(goalId);

    const eff = {
      country: qCountry ?? userDefaults.country ?? null,
      city: qCity ?? userDefaults.city ?? null,
      categoryIds: qCats ? qCats : (userDefaults.categoryIds.length ? userDefaults.categoryIds : null),
      subcategoryIds: qSubcats ? qSubcats : (userDefaults.subcategoryIds.length ? userDefaults.subcategoryIds : null),
      goalIds: qGoals ? qGoals.map(String) : (userDefaults.goalIds.length ? userDefaults.goalIds : null),
    };

    // ===== 3) Guards (sem admin e sem o próprio) =====
    const baseUserGuards = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };

    // ===== 4) WHERE base para User =====
    const whereUserBase = { ...baseUserGuards };
    if (eff.country) whereUserBase.country = eff.country;
    if (eff.city) whereUserBase.city = like(eff.city);
    if (q) {
      whereUserBase[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const interestsWhere = {};
    if (eff.categoryIds) interestsWhere.categoryId = { [Op.in]: eff.categoryIds };
    if (eff.subcategoryIds) interestsWhere.subcategoryId = { [Op.in]: eff.subcategoryIds };

    const goalsWhere = {};
    if (eff.goalIds) goalsWhere.id = { [Op.in]: eff.goalIds.map(String) };

    const makeInterestsInclude = (required) => ({
      model: UserCategory,
      as: "interests",
      required,
      where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
      include: [
        { model: Category, as: "category", attributes: ["id", "name"], required: false },
        { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false },
      ],
    });

    const makeGoalsInclude = (required) => ({
      model: Goal,
      as: "goals",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required,
      where: Object.keys(goalsWhere).length ? goalsWhere : undefined,
    });

    const profileInclude = {
      model: Profile,
      as: "profile",
      attributes: ["professionalTitle", "about", "avatarUrl"],
      required: false,
    };

    // ===== 5) Estratégia (filtros têm prioridade) =====
    const hasExplicitFilter = Boolean(q || qCountry || qCity || qCats || qSubcats || qGoals);

    let matchesRaw = [];

    if (hasExplicitFilter) {
      // Respeita filtros: o que vier vira required nos JOINs correspondentes
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [
          profileInclude,
          makeGoalsInclude(Boolean(qGoals)),
          makeInterestsInclude(Boolean(qCats || qSubcats)),
        ],
        limit: Number(limit),
        order: [["createdAt", "DESC"]],
      });
    } else if (currentUserId) {
      // Sem filtros: tenta goals -> categorias/subcats -> geral
      if (userDefaults.goalIds.length) {
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, makeGoalsInclude(true), makeInterestsInclude(false)],
          limit: Number(limit),
          order: [["createdAt", "DESC"]],
        });
      }
      if ((!matchesRaw || matchesRaw.length === 0) && (userDefaults.categoryIds.length || userDefaults.subcategoryIds.length)) {
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, makeGoalsInclude(false), makeInterestsInclude(true)],
          limit: Number(limit),
          order: [["createdAt", "DESC"]],
        });
      }
      if (!matchesRaw || matchesRaw.length === 0) {
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, makeGoalsInclude(false), makeInterestsInclude(false)],
          limit: Number(limit),
          order: [["createdAt", "DESC"]],
        });
      }
      // Ordena por maior overlap de goals, se o user tiver goals
      if (userDefaults.goalIds.length) {
        const mySet = new Set(userDefaults.goalIds.map(String));
        matchesRaw = matchesRaw
          .map((u) => {
            const ids = (u.goals || []).map((g) => String(g.id));
            const overlap = ids.filter((id) => mySet.has(id)).length;
            return { u, overlap };
          })
          .sort((a, b) => (b.overlap - a.overlap) || (new Date(b.u.createdAt) - new Date(a.u.createdAt)))
          .map((x) => x.u);
      }
    } else {
      // Público geral
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, makeGoalsInclude(false), makeInterestsInclude(false)],
        limit: Number(limit),
        order: [["createdAt", "DESC"]],
      });
    }

    // ===== 6) Nearby =====
    const nearbyWhere = { ...baseUserGuards };
    if (eff.city) nearbyWhere.city = like(eff.city);
    else if (eff.country) nearbyWhere.country = eff.country;
    if (q) {
      nearbyWhere[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const nearbyRaw = await User.findAll({
      subQuery: false,
      where: nearbyWhere,
      include: [
        profileInclude,
        makeGoalsInclude(Boolean(qGoals)),
        makeInterestsInclude(Boolean(qCats || qSubcats)),
      ],
      limit: Number(limit),
      order: [["createdAt", "DESC"]],
    });

    // ===== 7) Map =====
    const mapUser = (u, idx) => {
      const goalsNames = (u.goals || []).map((g) => g.name).filter(Boolean);
      return {
        id: u.id,
        name: u.name,
        role: u.profile?.professionalTitle || null,
        tag: goalsNames.join(", "),
        avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
        city: u.city || null,
        country: u.country || null,
        email: u.email,
        cats: (u.interests || []).map((it) => it.category?.name).filter(Boolean),
        subcats: (u.interests || []).map((it) => it.subcategory?.name).filter(Boolean),
        mockIndex: 30 + idx,
      };
    };

    const matches = matchesRaw.map(mapUser);
    const nearby  = nearbyRaw.map(mapUser);

    res.json({
      matchesCount: matches.length,
      nearbyCount: nearby.length,
      matches,
      nearby,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
};


