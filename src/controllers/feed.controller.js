// src/controllers/feed.controller.js
const { Op } = require("sequelize");
const {
  Job,
  Event,
  Category,
  Subcategory,
  User,
  Profile,
  UserCategory,
  Goal,
  Connection,
  ConnectionRequest,
  Identity,
  Service,
  Product,
  Tourism,
  Funding, // [FUNDING] import
} = require("../models");
const { getConnectionStatusMap } = require("../utils/connectionStatus");

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    include: [{ model: Subcategory, as: "subcategories" }],
    order: [
      ["name", "ASC"],
      [{ model: Subcategory, as: "subcategories" }, "name", "ASC"],
    ],
  });

  const identities = await Identity.findAll({
    include: [
      {
        model: Category,
        as: "categories",
        include: [{ model: Subcategory, as: "subcategories" }],
      },
    ],
    order: [
      ["name", "ASC"],
      [{ model: Category, as: "categories" }, "name", "ASC"],
      [
        { model: Category, as: "categories" },
        { model: Subcategory, as: "subcategories" },
        "name",
        "ASC",
      ],
    ],
  });

  const goals = await Goal.findAll({ order: [["name", "ASC"]] });

  const countries = [
    "Angola","Ghana","Nigeria","Kenya","South Africa","Mozambique","Tanzania","Uganda","Zimbabwe","Zambia",
    "Namibia","Cameroon","Senegal","Ivory Coast","Rwanda","Ethiopia","Morocco","Egypt","Sudan"
  ];

  res.json({
    goals,
    identities: identities.map((i) => ({
      id: String(i.id),
      name: i.name,
      categories: categories.map((c) => ({
        id: String(c.id),
        name: c.name,
        subcategories: (c.subcategories || []).map((s) => ({
          id: String(s.id),
          name: s.name,
        })),
      })),
    })),
    categories: categories.map((c) => ({
      id: String(c.id),
      name: c.name,
      subcategories: (c.subcategories || []).map((s) => ({
        id: String(s.id),
        name: s.name,
      })),
    })),
    countries,
  });
};

const like = (v) => ({ [Op.like]: `%${v}%` });
const pickNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---- Humanizer
function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;

  if (diff < 45) return "Just now";
  if (diff < 90) return "1 min ago";

  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString();
}

// Includes (jobs & events)
const includeCategoryRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  {
    model: User,
    as: "postedBy",
    attributes: ["id", "name", "avatarUrl"],
    include: [
      { model: Profile, as: "profile", attributes: ["avatarUrl"] }
    ]
  },
];

const includeEventRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  { model: User, as: "organizer", attributes: ["id", "name"] },
];

// [SERVICE] include → provider + interests(+category/subcategory)
function makeServiceInclude({ categoryId, subcategoryId }) {
  const interestsWhere = {};
  if (categoryId) interestsWhere.categoryId = categoryId;
  if (subcategoryId) interestsWhere.subcategoryId = subcategoryId;

  const needInterests = Boolean(categoryId || subcategoryId);

  return [
    {
      model: User,
      as: "provider",
      attributes: ["id", "name"],
      include: [
        {
          model: UserCategory,
          as: "interests",
          required: needInterests,
          where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
          include: [
            { model: Category, as: "category", attributes: ["id", "name"], required: false },
            { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false },
          ],
        },
      ],
    },
  ];
}

// [PRODUCT] include → seller + audience M2M
function makeProductInclude({ categoryId, subcategoryId }) {
  const include = [
    { model: User, as: "seller", attributes: ["id", "name"] },
    {
      model: Category,
      as: "audienceCategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Subcategory,
      as: "audienceSubcategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };

  return include;
}

// [TOURISM] include → author + audience M2M
function makeTourismInclude({ categoryId, subcategoryId }) {
  const include = [
    { model: User, as: "author", attributes: ["id", "name"] },
    {
      model: Category,
      as: "audienceCategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Subcategory,
      as: "audienceSubcategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };

  return include;
}

// [FUNDING] include → creator + direct category + audience M2M
function makeFundingInclude({ categoryId, subcategoryId }) {
  const include = [
    { model: User, as: "creator", attributes: ["id", "name"] },
    { model: Category, as: "category", attributes: ["id", "name"], required: false },
    {
      model: Category,
      as: "audienceCategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Subcategory,
      as: "audienceSubcategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];

  // We’ll filter with a WHERE using `$audienceCategories.id$` / `$audienceSubcategories.id$` OR direct `categoryId`
  // so includes can remain not-required here.
  return include;
}

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

    // ---------------- WHEREs from filters ----------------
    const whereCommon = {};
    if (country) whereCommon.country = country;
    if (city) whereCommon.city = like(city);

    const whereJob = { ...whereCommon };
    const whereEvent = { ...whereCommon };
    const whereService = { ...whereCommon };

    // Products: country only
    const whereProduct = {};
    if (country) whereProduct.country = country;

    // Tourism: country + location (uses ?city)
    const whereTourism = {};
    if (country) whereTourism.country = country;
    if (city) whereTourism.location = like(city);

    // Funding: country + city, optional status/visibility if you want (left open)
    const whereFunding = {};
    if (country) whereFunding.country = country;
    if (city) whereFunding.city = like(city);

    if (categoryId) {
      whereJob.categoryId = categoryId;
      whereEvent.categoryId = categoryId;
      // services via include(User->interests)
      // products/tourism via M2M includes
      // funding supports BOTH direct categoryId and audience M2M (handled below with $paths)
    }
    if (subcategoryId) {
      whereJob.subcategoryId = subcategoryId;
      whereEvent.subcategoryId = subcategoryId;
      // products/tourism/funding via M2M
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
      whereService[Op.or] = [
        { title: like(q) },
        { description: like(q) },
        { city: like(q) },
      ];
      whereProduct[Op.or] = [
        { title: like(q) },
        { description: like(q) },
      ];
      whereTourism[Op.or] = [
        { title: like(q) },
        { description: like(q) },
        { location: like(q) },
      ];
      whereFunding[Op.or] = [
        { title: like(q) },
        { pitch: like(q) },
        { city: like(q) },
      ];
    }

    // Add OR filters for Funding audience (and direct category)
    // Use subQuery:false in queries where these $paths are used.
    if (categoryId) {
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        { categoryId }, // direct
        { "$audienceCategories.id$": categoryId }, // M2M
      ];
    }
    if (subcategoryId) {
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        { "$audienceSubcategories.id$": subcategoryId },
      ];
    }

    // ---------------- Connection status decorator ----------------
    async function getConStatusItems(items) {
      const currentUserId = req.user?.id || null;
      const targetIds = items
        .map((it) =>
          it.kind === "job"
            ? it.postedByUserId
            : it.kind === "event"
            ? it.organizerUserId
            : it.kind === "service"
            ? it.providerUserId
            : it.kind === "product"
            ? it.sellerUserId
            : it.kind === "tourism"
            ? it.authorUserId
            : it.kind === "funding"
            ? it.creatorUserId
            : null
        )
        .filter(Boolean);

      const statusMap = await getConnectionStatusMap(currentUserId, targetIds, {
        Connection,
        ConnectionRequest,
      });

      const withStatus = items.map((it) => {
        const ownerId =
          it.kind === "job"
            ? it.postedByUserId
            : it.kind === "event"
            ? it.organizerUserId
            : it.kind === "service"
            ? it.providerUserId
            : it.kind === "product"
            ? it.sellerUserId
            : it.kind === "tourism"
            ? it.authorUserId
            : it.kind === "funding"
            ? it.creatorUserId
            : null;

        return {
          ...it,
          connectionStatus: ownerId
            ? statusMap[ownerId] || (currentUserId ? "none" : "unauthenticated")
            : currentUserId
            ? "none"
            : "unauthenticated",
        };
      });

      return withStatus;
    }

    // ---------------- Mappers ----------------
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
      postedByUserId: j.postedByUserId || null,
      postedByUserName: j.postedBy?.name || null,
      postedByUserAvatarUrl: j.postedBy?.avatarUrl || j.postedBy?.profile?.avatarUrl || null,
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
      organizerUserId: e.organizerUserId || null,
      organizerUserName: e.organizer?.name || null,
    });

    // [SERVICE] representative cat/subcat from provider interests
    function pickServiceCatSub(svc, preferredCatId, preferredSubId) {
      const ints = svc.provider?.interests || [];
      if (!ints.length) return {};
      let hit =
        (preferredSubId &&
          ints.find((i) => String(i.subcategoryId) === String(preferredSubId))) ||
        (preferredCatId &&
          ints.find((i) => String(i.categoryId) === String(preferredCatId))) ||
        ints[0];

      return {
        categoryId: hit?.categoryId ?? null,
        categoryName: hit?.category?.name ?? "",
        subcategoryId: hit?.subcategoryId ?? null,
        subcategoryName: hit?.subcategory?.name ?? "",
      };
    }

    const mapService = (s) => {
      const picked = pickServiceCatSub(s, categoryId, subcategoryId);
      return {
        kind: "service",
        id: s.id,
        title: s.title,
        serviceType: s.serviceType,
        description: s.description,
        priceAmount: s.priceAmount,
        priceType: s.priceType,
        deliveryTime: s.deliveryTime,
        locationType: s.locationType,
        experienceLevel: s.experienceLevel,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        city: s.city,
        country: s.country,
        createdAt: s.createdAt,
        timeAgo: timeAgo(s.createdAt),
        providerUserId: s.providerUserId || null,
        providerUserName: s.provider?.name || null,
      };
    };

    // [PRODUCT] pick representative category/subcategory from audience M2M
    function pickProductCatSub(prod, preferredCatId, preferredSubId) {
      const cats = prod.audienceCategories || [];
      const subs = prod.audienceSubcategories || [];

      const subHit =
        (preferredSubId &&
          subs.find((s) => String(s.id) === String(preferredSubId))) ||
        subs[0];

      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId &&
          cats.find((c) => String(c.id) === String(preferredCatId))) ||
        cats[0];

      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }

      return {};
    }

    const mapProduct = (p) => {
      const picked = pickProductCatSub(p, categoryId, subcategoryId);
      return {
        kind: "product",
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        quantity: p.quantity,
        tags: Array.isArray(p.tags) ? p.tags : [],
        images: Array.isArray(p.images) ? p.images : [],
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        country: p.country || null,
        createdAt: p.createdAt,
        timeAgo: timeAgo(p.createdAt),
        sellerUserId: p.sellerUserId || null,
        sellerUserName: p.seller?.name || null,
      };
    };

    // [TOURISM] pick representative category/subcategory from audience M2M
    function pickTourismCatSub(t, preferredCatId, preferredSubId) {
      const cats = t.audienceCategories || [];
      const subs = t.audienceSubcategories || [];

      const subHit =
        (preferredSubId &&
          subs.find((s) => String(s.id) === String(preferredSubId))) ||
        subs[0];
      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId &&
          cats.find((c) => String(c.id) === String(preferredCatId))) ||
        cats[0];
      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }

      return {};
    }

    const mapTourism = (t) => {
      const picked = pickTourismCatSub(t, categoryId, subcategoryId);
      return {
        kind: "tourism",
        id: t.id,
        postType: t.postType, // Destination | Experience | Culture
        title: t.title,
        description: t.description,
        season: t.season || null,
        budgetRange: t.budgetRange || null,
        tags: Array.isArray(t.tags) ? t.tags : [],
        images: Array.isArray(t.images) ? t.images : [],
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        location: t.location || null,
        country: t.country || null,
        createdAt: t.createdAt,
        timeAgo: timeAgo(t.createdAt),
        authorUserId: t.authorUserId || null,
        authorUserName: t.author?.name || null,
      };
    };

    // [FUNDING] pick representative category/subcategory from audience; prefer direct category if present
    function pickFundingCatSub(f, preferredCatId, preferredSubId) {
      // Prefer the direct category if set
      if (f.category) {
        return {
          categoryId: f.category.id,
          categoryName: f.category.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }

      // Fallback to audience sets
      const cats = f.audienceCategories || [];
      const subs = f.audienceSubcategories || [];

      const subHit =
        (preferredSubId &&
          subs.find((s) => String(s.id) === String(preferredSubId))) ||
        subs[0];

      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId &&
          cats.find((c) => String(c.id) === String(preferredCatId))) ||
        cats[0];

      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }

      return {};
    }

    const mapFunding = (f) => {
      const picked = pickFundingCatSub(f, categoryId, subcategoryId);
      return {
        kind: "funding",
        id: f.id,
        title: f.title,
        pitch: f.pitch,
        goal: f.goal,
        currency: f.currency,
        deadline: f.deadline, // YYYY-MM-DD
        rewards: f.rewards || null,
        team: f.team || null,
        email: f.email || null,
        phone: f.phone || null,
        status: f.status,
        visibility: f.visibility,
        tags: Array.isArray(f.tags) ? f.tags : [],
        links: Array.isArray(f.links) ? f.links : [],
        images: Array.isArray(f.images) ? f.images : [],
        // derived category/subcategory (prefers direct category)
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        // location
        city: f.city || null,
        country: f.country || null,
        createdAt: f.createdAt,
        timeAgo: timeAgo(f.createdAt),
        creatorUserId: f.creatorUserId || null,
        creatorUserName: f.creator?.name || null,
      };
    };

    // ---------------- Scoring ----------------
    const userCatSet = new Set(userDefaults.categoryIds || []);
    const userSubSet = new Set(userDefaults.subcategoryIds || []);
    const userCity = (userDefaults.city || "").toLowerCase();
    const userCountry = userDefaults.country || null;

    const scoreItem = (x) => {
      let s = 0;
      const subId = Number(x.subcategoryId || 0);
      const catId = Number(x.categoryId || 0);
      if (subId && userSubSet.has(subId)) s += 4;
      else if (catId && userCatSet.has(catId)) s += 3;

      const itemCity = (x.city || x.location || "").toLowerCase();
      if (userCity && itemCity && itemCity === userCity) s += 2;

      if (userCountry && x.country === userCountry) s += 1;
      return s;
    };

    // ---------------- Flows ----------------
    // (A) Filters present OR no user → use filters only
    if (isFilterActive || !currentUserId) {
      if (tab === "events") {
        const events = await Event.findAll({
          where: whereEvent,
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(events.map(mapEvent)) });
      }

      if (tab === "jobs") {
        const jobs = await Job.findAll({
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(jobs.map(mapJob)) });
      }

      if (tab === "services") {
        const services = await Service.findAll({
          where: whereService,
          include: makeServiceInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(services.map(mapService)) });
      }

      if (tab === "products") {
        const products = await Product.findAll({
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(products.map(mapProduct)) });
      }

      if (tab === "tourism") {
        const tourism = await Tourism.findAll({
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(tourism.map(mapTourism)) });
      }

      // [FUNDING] tab
      if (tab === "funding") {
        const funding = await Funding.findAll({
          subQuery: Boolean(categoryId || subcategoryId), // needed for $audience...$ filtering
          where: whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(funding.map(mapFunding)) });
      }

      // “All”
      const [jobsAll, eventsAll, servicesAll, productsAll, tourismAll, fundingAll] = await Promise.all([
        Job.findAll({
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Event.findAll({
          where: whereEvent,
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Service.findAll({
          where: whereService,
          include: makeServiceInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Product.findAll({
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Tourism.findAll({
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Funding.findAll({
          subQuery: Boolean(categoryId || subcategoryId),
          where: whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
      ]);

      const merged = [
        ...jobsAll.map(mapJob),
        ...eventsAll.map(mapEvent),
        ...servicesAll.map(mapService),
        ...productsAll.map(mapProduct),
        ...tourismAll.map(mapTourism),
        ...fundingAll.map(mapFunding),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const windowed = merged.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // (B) No filters & has user → prioritization (score)
    const bufferFactor = 3;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        include: includeEventRefs,
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
      return res.json({ items: await getConStatusItems(windowed) });
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
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "services") {
      const services = await Service.findAll({
        include: makeServiceInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = services
        .map(mapService)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "products") {
      const products = await Product.findAll({
        include: makeProductInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = products
        .map(mapProduct)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "tourism") {
      const tourism = await Tourism.findAll({
        include: makeTourismInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = tourism
        .map(mapTourism)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // [FUNDING] prioritized
    if (tab === "funding") {
      const funding = await Funding.findAll({
        include: makeFundingInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const scored = funding
        .map(mapFunding)
        .map((x) => ({ ...x, _score: scoreItem(x) }));
      scored.sort(
        (a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
      const windowed = scored.slice(off, off + lim).map(({ _score, ...rest }) => rest);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // “All” prioritized
    const [jobsBuf, eventsBuf, servicesBuf, productsBuf, tourismBuf, fundingBuf] = await Promise.all([
      Job.findAll({
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Event.findAll({
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Service.findAll({
        include: makeServiceInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Product.findAll({
        include: makeProductInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Tourism.findAll({
        include: makeTourismInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Funding.findAll({
        include: makeFundingInclude({ categoryId: null, subcategoryId: null }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
    ]);

    const mergedScored = [
      ...jobsBuf.map(mapJob),
      ...eventsBuf.map(mapEvent),
      ...servicesBuf.map(mapService),
      ...productsBuf.map(mapProduct),
      ...tourismBuf.map(mapTourism),
      ...fundingBuf.map(mapFunding),
    ].map((x) => ({ ...x, _score: scoreItem(x) }));

    mergedScored.sort(
      (a, b) =>
        b._score - a._score ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const windowed = mergedScored
      .slice(off, off + lim)
      .map(({ _score, ...rest }) => rest);

    return res.json({ items: await getConStatusItems(windowed) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get feed" });
  }
};

// ---------------- Suggestions (unchanged) ----------------
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
      categoryId,
      cats,
      subcategoryId,
      goalId,
      limit = 10,
    } = req.query;

    const like = (v) => ({ [Op.like]: `%${v}%` });

    const currentUserId = req.user?.id || null;

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

    const baseUserGuards = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };

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

    const hasExplicitFilter = Boolean(q || qCountry || qCity || qCats || qSubcats || qGoals);

    let matchesRaw = [];

    if (hasExplicitFilter) {
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
      if (userDefaults.goalIds.length) {
        const mySet = new Set(userDefaults.goalIds.map(String));
        matchesRaw = matchesRaw
          .map((u) => {
            const ids = (u.goals || []).map((g) => String(g.id));
            const overlap = ids.filter((id) => mySet.has(id)).length;
            return { u, overlap };
          })
          .sort(
            (a, b) =>
              b.overlap - a.overlap ||
              new Date(b.u.createdAt) - new Date(a.u.createdAt)
          )
          .map((x) => x.u);
      }
    } else {
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, makeGoalsInclude(false), makeInterestsInclude(false)],
        limit: Number(limit),
        order: [["createdAt", "DESC"]],
      });
    }

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

    let matches = matchesRaw.map(mapUser);
    let nearby = nearbyRaw.map(mapUser);

    const allTargets = [...matches, ...nearby].map((u) => u.id).filter(Boolean);
    const statusMap = await getConnectionStatusMap(currentUserId, allTargets, {
      Connection,
      ConnectionRequest,
    });

    const decorate = (arr) =>
      arr.map((u) => ({
        ...u,
        connectionStatus:
          statusMap[u.id] || (currentUserId ? "none" : "unauthenticated"),
      }));

    matches = decorate(matches).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );
    nearby = decorate(nearby).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );

    res.json({
      matchesCount: matches.length,
      nearbyCount: nearby.length,
      matches: matches,
      nearby: nearby,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
};
