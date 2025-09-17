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
  Funding,
  SubsubCategory,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  UserBlock,
  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,
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

// ---------- helpers ----------
const like = (v) => ({ [Op.like]: `%${v}%` });
const pickNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
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
function buildOrLikes(field, values) {
  return (values || []).filter(Boolean).map((v) => ({ [field]: like(v) }));
}

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

// Enhanced includes for jobs with audience associations
const includeCategoryRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
  {
    model: User,
    as: "postedBy",
    attributes: ["id", "name", "avatarUrl"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
  },
  // Audience associations
  {
    model: Category,
    as: "audienceCategories",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: Subcategory,
    as: "audienceSubcategories",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: SubsubCategory,
    as: "audienceSubsubs",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: Identity,
    as: "audienceIdentities",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
];

const includeEventRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
  // General taxonomy
  { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
  { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
  { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
  {
    model: User,
    as: "organizer",
    attributes: ["id", "name", "avatarUrl"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
  },
  // Audience associations
  {
    model: Category,
    as: "audienceCategories",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: Subcategory,
    as: "audienceSubcategories",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: SubsubCategory,
    as: "audienceSubsubs",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
  {
    model: Identity,
    as: "audienceIdentities",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
];

async function makeCompanyMapById(ids) {
  const uniq = Array.from(new Set((ids || []).filter(Boolean).map(String)));
  if (!uniq.length) return {};

  const companies = await User.findAll({
    where: { id: { [Op.in]: uniq }, accountType: "company" },
    attributes: ["id", "name", "avatarUrl", "accountType"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl", "professionalTitle"] }],
  });

  const map = {};
  for (const c of companies) {
    map[String(c.id)] = {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl || c.profile?.avatarUrl || null,
      accountType: c.accountType || null,
      professionalTitle: c.profile?.professionalTitle || null,
    };
  }
  return map;
}

// [SERVICE] include → provider + interests + audience associations
function makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const interestsWhere = {};
  if (categoryId) interestsWhere.categoryId = categoryId;
  if (subcategoryId) interestsWhere.subcategoryId = subcategoryId;
  if (subsubCategoryId) interestsWhere.subsubcategoryId = subsubCategoryId;

  const needInterests = Boolean(categoryId || subcategoryId || subsubCategoryId);

  return [
    {
      model: User,
      as: "provider",
      attributes: ["id", "name", "avatarUrl"],
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
        { model: Profile, as: "profile", attributes: ["avatarUrl"] },
      ],
    },
    // Direct associations
    { model: Category, as: "category", attributes: ["id", "name"] },
    { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
    { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
    // General taxonomy
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
    // Audience associations
    {
      model: Category,
      as: "audienceCategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: !!categoryId,
      where: categoryId ? { id: categoryId } : undefined,
    },
    {
      model: Subcategory,
      as: "audienceSubcategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: !!subcategoryId,
      where: subcategoryId ? { id: subcategoryId } : undefined,
    },
    {
      model: SubsubCategory,
      as: "audienceSubsubs",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: !!subsubCategoryId,
      where: subsubCategoryId ? { id: subsubCategoryId } : undefined,
    },
    {
      model: Identity,
      as: "audienceIdentities",
      attributes: ["id", "name"],
      through: { attributes: [] },
    },
  ];
}

// [PRODUCT] include → seller + audience M2M with enhanced associations
function makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "seller",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
    // General taxonomy
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
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
    {
      model: SubsubCategory,
      as: "audienceSubsubs",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Identity,
      as: "audienceIdentities",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };
  if (subsubCategoryId) include[3] = { ...include[3], required: true, where: { id: subsubCategoryId } };

  return include;
}

// [TOURISM] include → author + audience M2M with enhanced associations
function makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "author",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
    // General taxonomy
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
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
    {
      model: SubsubCategory,
      as: "audienceSubsubs",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Identity,
      as: "audienceIdentities",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };
  if (subsubCategoryId) include[3] = { ...include[3], required: true, where: { id: subsubCategoryId } };

  return include;
}

// [FUNDING] include → creator + direct category + audience M2M with enhanced associations
function makeFundingInclude(/* { categoryId, subcategoryId, subsubCategoryId } */) {
  return [
    {
      model: User,
      as: "creator",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
    { model: Category, as: "category", attributes: ["id", "name"], required: false },
    // General taxonomy
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
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
    {
      model: SubsubCategory,
      as: "audienceSubsubs",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
    {
      model: Identity,
      as: "audienceIdentities",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: false,
    },
  ];
}

/* ---- NEW: sorting + diversification helpers ---- */
function sortByMatchThenRecency(arr) {
  return arr.sort(
    (a, b) =>
      (b.matchPercentage || 0) - (a.matchPercentage || 0) ||
      new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * Diversify a list by item.kind so you don't see a long run of the same kind.
 * maxSeq = maximum allowed consecutive items of the same kind.
 */
function diversifyFeed(items, { maxSeq = 1 } = {}) {
  const pool = items.slice(); // already sorted by matchPercentage desc
  const out = [];
  let lastKind = null;
  let streak = 0;

  while (pool.length) {
    // try to pick the first item that doesn't break maxSeq rule
    let pickIdx = pool.findIndex((it) => {
      if (!lastKind) return true;
      if (it.kind !== lastKind) return true;
      return streak < maxSeq; // allow if streak still below cap
    });

    if (pickIdx === -1) {
      // no alternative found; fallback to the first (keeps progress)
      pickIdx = 0;
    }

    const [picked] = pool.splice(pickIdx, 1);
    if (picked.kind === lastKind) {
      streak += 1;
    } else {
      lastKind = picked.kind;
      streak = 1;
    }
    out.push(picked);
  }

  return out;
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
      subsubCategoryId,
      identityId,

      // Industry filters
      industryIds,

      // General taxonomy filters
      generalCategoryIds,
      generalSubcategoryIds,
      generalSubsubCategoryIds,

      // Audience filters from AudienceTree
      audienceIdentityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,

      // products
      price,              // field: price
      // services
      serviceType,        // field: serviceType
      priceType,          // field: priceType
      deliveryTime,       // field: deliveryTime

      // shared (Jobs, Services)
      experienceLevel,    // field: experienceLevel
      locationType,       // field: locationType
      // jobs
      jobType,            // field: jobType
      workMode,           // field: workMode
      // tourism
      postType,           // field: postType
      season,             // field: season
      budgetRange,        // field: budgetRange
      // funding
      fundingGoal,        // field: goal
      amountRaised,       // field: raised
      deadline,           // field: deadline
      // events
      date,
      eventType,          // field: eventType
      registrationType,   // field: registrationType

      limit = 20,
      offset = 0,
    } = req.query;

    // Parse city as array to support multiple cities
    const cities = ensureArray(city);
    console.log("Cities filter:", cities);

    // Parse industry filter IDs
    const effIndustryIds = ensureArray(industryIds).filter(Boolean);

    console.log("Feed request:", {
      tab, q, country, city, categoryId, subcategoryId, subsubCategoryId, identityId,
      industryIds: effIndustryIds,
      generalCategoryIds, generalSubcategoryIds, generalSubsubCategoryIds,
      audienceIdentityIds, audienceCategoryIds, audienceSubcategoryIds, audienceSubsubCategoryIds,
      price, serviceType, priceType, deliveryTime, experienceLevel, locationType,
      jobType, workMode, postType, season, budgetRange, fundingGoal, amountRaised, deadline,
      eventType, date, registrationType
    });

    // Improved text search handling
    let searchTerms = [];
    if (q) {
      searchTerms = q.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);
    }

    const lim = pickNumber(limit) ?? 20;
    const off = pickNumber(offset) ?? 0;

    // Parse audience filter IDs
    const effAudienceIdentityIds = ensureArray(audienceIdentityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);

    // Parse general taxonomy filter IDs
    const effGeneralCategoryIds = ensureArray(generalCategoryIds).filter(Boolean);
    const effGeneralSubcategoryIds = ensureArray(generalSubcategoryIds).filter(Boolean);
    const effGeneralSubsubCategoryIds = ensureArray(generalSubsubCategoryIds).filter(Boolean);

    // Convert to strings
    const effAudienceIdentityIdsStr = effAudienceIdentityIds.map(String);
    const effAudienceCategoryIdsStr = effAudienceCategoryIds.map(String);
    const effAudienceSubcategoryIdsStr = effAudienceSubcategoryIds.map(String);
    const effAudienceSubsubCategoryIdsStr = effAudienceSubsubCategoryIds.map(String);

    const effGeneralCategoryIdsStr = effGeneralCategoryIds.map(String);
    const effGeneralSubcategoryIdsStr = effGeneralSubcategoryIds.map(String);
    const effGeneralSubsubCategoryIdsStr = effGeneralSubsubCategoryIds.map(String);

    console.log("Audience filter parameters:", {
      identityIds: effAudienceIdentityIds,
      audienceCategoryIds: effAudienceCategoryIds,
      audienceSubcategoryIds: effAudienceSubcategoryIds,
      audienceSubsubCategoryIds: effAudienceSubsubCategoryIds
    });
    console.log("General taxonomy filter parameters:", {
      generalCategoryIds: effGeneralCategoryIds,
      generalSubcategoryIds: effGeneralSubcategoryIds,
      generalSubsubCategoryIds: effGeneralSubsubCategoryIds
    });

    const hasTextSearch = Boolean(q && searchTerms.length > 0);
    const currentUserId = req.user?.id || null;

    const hasExplicitFilter = Boolean(
      country || city || categoryId || subcategoryId || subsubCategoryId || identityId ||
      effIndustryIds.length ||
      effGeneralCategoryIds.length || effGeneralSubcategoryIds.length || effGeneralSubsubCategoryIds.length ||
      effAudienceIdentityIds.length || effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length || effAudienceSubsubCategoryIds.length ||
      price || serviceType || priceType || deliveryTime ||
      experienceLevel || locationType || jobType || workMode ||
      postType || season || budgetRange ||
      fundingGoal || amountRaised || deadline ||
      eventType || date || registrationType ||
      hasTextSearch || (cities && cities.length > 0)
    );

    // Enhanced user defaults
    let userDefaults = {
      country: null,
      city: null,
      // interests (what the user wants)
      interestCategoryIds: [],
      interestSubcategoryIds: [],
      interestSubsubCategoryIds: [],
      interestIdentityIds: [],
      // attributes (what the user is)
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: [],
    };

    if (currentUserId) {
      try {
        const me = await User.findByPk(currentUserId, {
          attributes: ["id", "country", "city", "accountType"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["categoryId", "subcategoryId"],
              required: false,
            },
            { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          ],
        });

        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;

          const attributeCats = (me.interests || []).map((i) => i.categoryId).filter(Boolean);
          const attributeSubs = (me.interests || []).map((i) => i.subcategoryId).filter(Boolean);

          if (me.profile?.categoryId) attributeCats.push(me.profile.categoryId);
          if (me.profile?.subcategoryId) attributeSubs.push(me.profile.subcategoryId);

          userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
          userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));

          // Initialize interest arrays
          userDefaults.interestCategoryIds = [];
          userDefaults.interestSubcategoryIds = [];
          userDefaults.interestSubsubCategoryIds = [];
          userDefaults.interestIdentityIds = [];

          try {
            const categoryInterests = await UserCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
            });
            userDefaults.interestCategoryIds = categoryInterests.map((i) => i.categoryId).filter(Boolean);
          } catch (e) {
            console.log("Category interests not available:", e.message);
          }

          try {
            const subcategoryInterests = await UserSubcategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubcategoryIds = subcategoryInterests.map((i) => i.subcategoryId).filter(Boolean);
          } catch (e) {
            console.log("Subcategory interests not available:", e.message);
          }

          try {
            const subsubInterests = await UserSubsubCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubsubCategoryIds = subsubInterests.map((i) => i.subsubCategoryId).filter(Boolean);
          } catch (e) {
            console.log("Subsubcategory interests not available:", e.message);
          }

          try {
            const identityInterests = await UserIdentityInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }],
            });
            userDefaults.interestIdentityIds = identityInterests.map((i) => i.identityId).filter(Boolean);
          } catch (e) {
            console.log("Identity interests not available:", e.message);
          }

          console.log("User interests loaded:", {
            categories: userDefaults.interestCategoryIds,
            subcategories: userDefaults.interestSubcategoryIds,
            subsubcategories: userDefaults.interestSubsubCategoryIds,
            identities: userDefaults.interestIdentityIds,
          });
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    }

    // ---------------- WHEREs from filters ----------------
    // Parse country as array
    const countries = ensureArray(country);
    console.log("Countries filter:", countries);

    // Flexible location matching without invalid Op.in + Op.like combos
    const createFlexibleLocationFilter = () => {
      const filter = {};

      // Build parts
      const countryExact = countries.length ? [{ country: { [Op.in]: countries } }] : [];
      const cityLikes = buildOrLikes("city", cities);
      const cityInCountryField = buildOrLikes("country", cities);
      const countryInCityField = buildOrLikes("city", countries);

      const orParts = [];

      // If both provided, allow either dimension to match
      if (countries.length && cities.length) {
        orParts.push(...countryExact, ...cityLikes, ...countryInCityField, ...cityInCountryField);
      } else if (countries.length) {
        orParts.push(...countryExact, ...countryInCityField);
      } else if (cities.length) {
        orParts.push(...cityLikes, ...cityInCountryField);
      }

      if (orParts.length) {
        filter[Op.or] = orParts;
      }

      return filter;
    };

    // Create flexible location filters for each item type
    const whereCommon = createFlexibleLocationFilter();
    const whereJob = { ...whereCommon };
    const whereEvent = { ...whereCommon };
    const whereService = { ...whereCommon };

    // Apply general taxonomy filters to whereService
    if (effGeneralCategoryIds.length > 0) {
      whereService.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereService.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereService.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    // Apply general taxonomy filters to whereEvent
    if (effGeneralCategoryIds.length > 0) {
      whereEvent.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereEvent.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereEvent.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    // Products: only country field; compose an Op.or safely
    const whereProduct = {};
    const productOr = [];
    if (countries.length) productOr.push({ country: { [Op.in]: countries } });
    if (cities.length) productOr.push(...buildOrLikes("country", cities));
    if (productOr.length) whereProduct[Op.or] = productOr;
    if (price) whereProduct.price = { [Op.lte]: Number(price) };

    // Apply general taxonomy filters to whereProduct
    if (effGeneralCategoryIds.length > 0) whereProduct.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereProduct.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereProduct.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    // Tourism: has country + location; build Op.or safely
    const whereTourism = {};
    const tourismOr = [];
    if (countries.length) {
      tourismOr.push({ country: { [Op.in]: countries } });
      tourismOr.push(...buildOrLikes("location", countries)); // country names may appear in location
    }
    if (cities.length) {
      tourismOr.push(...buildOrLikes("location", cities));
      tourismOr.push(...buildOrLikes("country", cities)); // city may appear in country text field
    }
    if (tourismOr.length) whereTourism[Op.or] = tourismOr;

    // Apply general taxonomy filters to whereTourism
    if (effGeneralCategoryIds.length > 0) whereTourism.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereTourism.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereTourism.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    // Funding: flexible location
    const whereFunding = createFlexibleLocationFilter();

    // Apply general taxonomy filters to whereFunding
    if (effGeneralCategoryIds.length > 0) whereFunding.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereFunding.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereFunding.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    let excludedUserIds = [];
    if (currentUserId) {
      const [iBlock, theyBlock] = await Promise.all([
        UserBlock.findAll({ where: { blockerId: currentUserId }, attributes: ["blockedId"] }),
        UserBlock.findAll({ where: { blockedId: currentUserId }, attributes: ["blockerId"] }),
      ]);
      excludedUserIds = [...new Set([
        ...iBlock.map((r) => String(r.blockedId)),
        ...theyBlock.map((r) => String(r.blockerId)),
      ])];
    }

    if (excludedUserIds.length) {
      whereJob.postedByUserId = { [Op.notIn]: excludedUserIds };
      whereEvent.organizerUserId = { [Op.notIn]: excludedUserIds };
      whereService.providerUserId = { [Op.notIn]: excludedUserIds };
      whereProduct.sellerUserId = { [Op.notIn]: excludedUserIds };
      whereTourism.authorUserId = { [Op.notIn]: excludedUserIds };
      whereFunding.creatorUserId = { [Op.notIn]: excludedUserIds };
    }

    // Funding-specific filters
    if (fundingGoal) whereFunding.goal = { [Op.lte]: Number(fundingGoal) };
    if (amountRaised) whereFunding.raised = { [Op.gte]: Number(amountRaised) };
    if (deadline) whereFunding.deadline = { [Op.gte]: deadline };

    // Taxonomy filters
    if (categoryId) {
      whereJob.categoryId = categoryId;
      whereEvent.categoryId = categoryId;
    }
    if (subcategoryId) {
      whereJob.subcategoryId = subcategoryId;
      whereEvent.subcategoryId = subcategoryId;
    }
    if (subsubCategoryId) {
      whereJob.subsubCategoryId = subsubCategoryId;
      whereEvent.subsubCategoryId = subsubCategoryId;
    }

    // Industry filters
    if (effIndustryIds.length > 0) {
      whereJob.industryCategoryId = { [Op.in]: effIndustryIds };
      whereEvent.industryCategoryId = { [Op.in]: effIndustryIds };
      whereService.industryCategoryId = { [Op.in]: effIndustryIds };
      whereProduct.industryCategoryId = { [Op.in]: effIndustryIds };
      whereTourism.industryCategoryId = { [Op.in]: effIndustryIds };
      whereFunding.industryCategoryId = { [Op.in]: effIndustryIds };
    }

    // Audience filters via $paths
    if (effAudienceIdentityIdsStr.length > 0) {
      const f = { "$audienceIdentities.id$": { [Op.in]: effAudienceIdentityIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
    }
    if (effAudienceCategoryIdsStr.length > 0) {
      const f = { "$audienceCategories.id$": { [Op.in]: effAudienceCategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
    }
    if (effAudienceSubcategoryIdsStr.length > 0) {
      const f = { "$audienceSubcategories.id$": { [Op.in]: effAudienceSubcategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
    }
    if (effAudienceSubsubCategoryIdsStr.length > 0) {
      const f = { "$audienceSubsubs.id$": { [Op.in]: effAudienceSubsubCategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
    }

    // job-specific
    if (jobType) {
      const jobTypes = jobType.split(",").filter(Boolean);
      if (jobTypes.length) whereJob.jobType = { [Op.in]: jobTypes };
    }
    if (workMode) {
      const workModes = workMode.split(",").filter(Boolean);
      if (workModes.length) whereJob.workMode = { [Op.in]: workModes };
    }
    if (experienceLevel) {
      const els = experienceLevel.split(",").filter(Boolean);
      if (els.length) {
        whereJob.experienceLevel = { [Op.in]: els };
        whereService.experienceLevel = { [Op.in]: els };
      }
    }
    if (locationType) {
      const lts = locationType.split(",").filter(Boolean);
      if (lts.length) {
        whereJob.locationType = { [Op.in]: lts };
        whereService.locationType = { [Op.in]: lts };
      }
    }

    // service-specific
    if (serviceType) {
      const sts = serviceType.split(",").filter(Boolean);
      if (sts.length) whereService.serviceType = { [Op.in]: sts };
    }
    if (priceType) {
      const pts = priceType.split(",").filter(Boolean);
      if (pts.length) whereService.priceType = { [Op.in]: pts };
    }
    if (deliveryTime) {
      const dts = deliveryTime.split(",").filter(Boolean);
      if (dts.length) whereService.deliveryTime = { [Op.in]: dts };
    }

    // tourism-specific
    if (postType) {
      const pts = postType.split(",").filter(Boolean);
      if (pts.length) whereTourism.postType = { [Op.in]: pts };
    }
    if (season) {
      const ss = season.split(",").filter(Boolean);
      if (ss.length) whereTourism.season = { [Op.in]: ss };
    }
    if (budgetRange) {
      const brs = budgetRange.split(",").filter(Boolean);
      if (brs.length) whereTourism.budgetRange = { [Op.in]: brs };
    }

    // event-specific
    if (eventType) {
      const ets = eventType.split(",").filter(Boolean);
      if (ets.length) whereEvent.eventType = { [Op.in]: ets };
    }
    if (date) whereEvent.date = { [Op.gte]: date };
    if (registrationType) {
      const rts = registrationType.split(",").filter(Boolean);
      if (rts.length) whereEvent.registrationType = { [Op.in]: rts };
    }

    // Enhanced text search with multiple terms
    if (hasTextSearch) {
      const termClauses = (fields) =>
        searchTerms.flatMap((term) => fields.map((f) => ({ [f]: like(term) })));

      whereJob[Op.or] = [
        ...(whereJob[Op.or] || []),
        ...termClauses(["title", "companyName", "city", "country"]),
      ];
      whereEvent[Op.or] = [
        ...(whereEvent[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
      whereService[Op.or] = [
        ...(whereService[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
      whereProduct[Op.or] = [
        ...(whereProduct[Op.or] || []),
        ...termClauses(["title", "description", "country"]),
      ];
      whereTourism[Op.or] = [
        ...(whereTourism[Op.or] || []),
        ...termClauses(["title", "description", "location", "country"]),
      ];
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        ...termClauses(["title", "pitch", "city", "country"]),
      ];
    }

    // Add Funding audience/direct category ORs
    if (categoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ categoryId }, { "$audienceCategories.id$": categoryId });
    }
    if (subcategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceSubcategories.id$": subcategoryId });
    }
    if (subsubCategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceSubsubs.id$": subsubCategoryId });
    }
    if (identityId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceIdentities.id$": identityId });
    }

    // Add industry ORs for funding (since funding can have direct industry or audience industry)
    if (effIndustryIds.length > 0) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ industryCategoryId: { [Op.in]: effIndustryIds } });
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
    const mapJob = (j, companyMap = null) => {
      const jobData = {
        kind: "job",
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        companyId: j.companyId || null,
        company: j.companyId && companyMap ? companyMap[String(j.companyId)] || null : null,
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
        avatarUrl: j.postedBy?.avatarUrl || j.postedBy?.profile?.avatarUrl || null,
        coverImage: j.coverImage || j.coverImageBase64 || null,
        audienceCategories: (j.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (j.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (j.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (j.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      if (currentUserId) {
        jobData.matchPercentage = calculateItemMatchPercentage(jobData);
      } else {
        jobData.matchPercentage = 20;
      }

      return jobData;
    };

    const mapEvent = (e) => {
      const eventData = {
        kind: "event",
        id: e.id,
        title: e.title,
        eventType: e.eventType,
        description: e.description,
        coverImageBase64: e.coverImageBase64,
        _debug_fields:
          process.env.NODE_ENV !== "production"
            ? Object.keys(e.dataValues || e).filter(
                (k) =>
                  typeof e[k] === "string" &&
                  (k.toLowerCase().includes("image") ||
                    k.toLowerCase().includes("cover") ||
                    k.toLowerCase().includes("photo"))
              )
            : null,
        coverImage: (() => {
          const possibleFields = [
            "coverImage",
            "coverImageBase64",
            "coverImageUrl",
            "overImage",
            "overImageUrl",
            "eventImage",
            "eventCover",
            "image",
            "imageUrl",
          ];
          for (const field of possibleFields) {
            if (e[field]) {
              let value = e[field];
              if (typeof value === "string" && value.startsWith("Url")) {
                value = value.substring(3);
              }
              return value;
            }
          }
          const imageFields = Object.keys(e.dataValues || e).filter(
            (k) =>
              typeof e[k] === "string" &&
              (k.toLowerCase().includes("image") ||
                k.toLowerCase().includes("cover") ||
                k.toLowerCase().includes("photo"))
          );
          if (imageFields.length > 0) {
            let value = e[imageFields[0]];
            if (typeof value === "string" && value.startsWith("Url")) {
              value = value.substring(3);
            }
            return value;
          }
          return null;
        })(),
        images: e.images
          ? typeof e.images === "string"
            ? JSON.parse(e.images || "[]")
            : Array.isArray(e.images)
            ? e.images
            : []
          : [],
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
        avatarUrl: e.organizer?.avatarUrl || e.organizer?.profile?.avatarUrl || null,
        audienceCategories: (e.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (e.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (e.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (e.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      eventData.matchPercentage = currentUserId ? calculateItemMatchPercentage(eventData) : 20;
      return eventData;
    };

    // [SERVICE] representative cat/subcat from provider interests
    function pickServiceCatSub(svc, preferredCatId, preferredSubId) {
      const ints = svc.provider?.interests || [];
      if (!ints.length) return {};
      let hit =
        (preferredSubId &&
          ints.find((i) => String(i.subcategoryId) === String(preferredSubId))) ||
        (preferredCatId && ints.find((i) => String(i.categoryId) === String(preferredCatId))) ||
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

      const serviceData = {
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
        images: s.attachments
          ? typeof s.attachments === "string"
            ? JSON.parse(s.attachments || "[]")
            : Array.isArray(s.attachments)
            ? s.attachments
            : []
          : [],
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
        avatarUrl: s.provider?.avatarUrl || s.provider?.profile?.avatarUrl || null,
        audienceCategories: (s.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (s.audienceSubcategories || []).map((sub) => ({ id: String(sub.id), name: sub.name })),
        audienceSubsubs: (s.audienceSubsubs || []).map((sub) => ({ id: String(sub.id), name: sub.name })),
        audienceIdentities: (s.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      serviceData.matchPercentage = currentUserId ? calculateItemMatchPercentage(serviceData) : 20;
      return serviceData;
    };

    // [PRODUCT] pick representative category/subcategory from audience M2M
    function pickProductCatSub(prod, preferredCatId, preferredSubId) {
      const cats = prod.audienceCategories || [];
      const subs = prod.audienceSubcategories || [];

      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];

      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];

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

      let parsedImages = [];
      try {
        if (Array.isArray(p.images)) parsedImages = p.images;
        else if (typeof p.images === "string") parsedImages = JSON.parse(p.images || "[]");
        else if (p.images && typeof p.images === "object") parsedImages = p.images;
      } catch (err) {
        console.error(`Error parsing images for product ${p.id}:`, err.message);
      }

      let parsedTags = [];
      try {
        if (Array.isArray(p.tags)) parsedTags = p.tags;
        else if (typeof p.tags === "string") parsedTags = JSON.parse(p.tags || "[]");
      } catch (err) {
        console.error(`Error parsing tags for product ${p.id}:`, err.message);
      }

      const productData = {
        kind: "product",
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        quantity: p.quantity,
        tags: parsedTags,
        images: parsedImages,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        country: p.country || null,
        createdAt: p.createdAt,
        timeAgo: timeAgo(p.createdAt),
        sellerUserId: p.sellerUserId || null,
        sellerUserName: p.seller?.name || null,
        avatarUrl: p.seller?.avatarUrl || p.seller?.profile?.avatarUrl || null,
        audienceCategories: (p.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (p.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (p.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (p.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      productData.matchPercentage = currentUserId ? calculateItemMatchPercentage(productData) : 20;
      return productData;
    };

    // [TOURISM] pick representative category/subcategory from audience M2M
    function pickTourismCatSub(t, preferredCatId, preferredSubId) {
      const cats = t.audienceCategories || [];
      const subs = t.audienceSubcategories || [];

      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];
      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];
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

      let parsedImages = [];
      try {
        if (Array.isArray(t.images)) parsedImages = t.images;
        else if (typeof t.images === "string") parsedImages = JSON.parse(t.images || "[]");
        else if (t.images && typeof t.images === "object") parsedImages = t.images;
      } catch (err) {
        console.error(`Error parsing images for tourism ${t.id}:`, err.message);
      }

      let parsedTags = [];
      try {
        if (Array.isArray(t.tags)) parsedTags = t.tags;
        else if (typeof t.tags === "string") parsedTags = JSON.parse(t.tags || "[]");
      } catch (err) {
        console.error(`Error parsing tags for tourism ${t.id}:`, err.message);
      }

      const tourismData = {
        kind: "tourism",
        id: t.id,
        postType: t.postType,
        title: t.title,
        description: t.description,
        season: t.season || null,
        budgetRange: t.budgetRange || null,
        tags: parsedTags,
        images: parsedImages,
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
        avatarUrl: t.author?.avatarUrl || t.author?.profile?.avatarUrl || null,
        audienceCategories: (t.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (t.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (t.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (t.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      tourismData.matchPercentage = currentUserId ? calculateItemMatchPercentage(tourismData) : 20;
      return tourismData;
    };

    // [FUNDING] pick representative category/subcategory
    function pickFundingCatSub(f, preferredCatId, preferredSubId) {
      if (f.category) {
        return {
          categoryId: f.category.id,
          categoryName: f.category.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }

      const cats = f.audienceCategories || [];
      const subs = f.audienceSubcategories || [];

      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];

      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }

      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];

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

      let parsedImages = [];
      try {
        if (Array.isArray(f.images)) parsedImages = f.images;
        else if (typeof f.images === "string") parsedImages = JSON.parse(f.images || "[]");
        else if (f.images && typeof f.images === "object") parsedImages = f.images;
      } catch (err) {
        console.error(`Error parsing images for funding ${f.id}:`, err.message);
      }

      let parsedTags = [];
      try {
        if (Array.isArray(f.tags)) parsedTags = f.tags;
        else if (typeof f.tags === "string") parsedTags = JSON.parse(f.tags || "[]");
      } catch (err) {
        console.error(`Error parsing tags for funding ${f.id}:`, err.message);
      }

      let parsedLinks = [];
      try {
        if (Array.isArray(f.links)) parsedLinks = f.links;
        else if (typeof f.links === "string") parsedLinks = JSON.parse(f.links || "[]");
      } catch (err) {
        console.error(`Error parsing links for funding ${f.id}:`, err.message);
      }

      const fundingData = {
        kind: "funding",
        id: f.id,
        title: f.title,
        pitch: f.pitch,
        goal: f.goal,
        currency: f.currency,
        deadline: f.deadline,
        rewards: f.rewards || null,
        team: f.team || null,
        email: f.email || null,
        phone: f.phone || null,
        status: f.status,
        visibility: f.visibility,
        tags: parsedTags,
        links: parsedLinks,
        raised: f.raised,
        images: parsedImages,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        city: f.city || null,
        country: f.country || null,
        createdAt: f.createdAt,
        timeAgo: timeAgo(f.createdAt),
        creatorUserId: f.creatorUserId || null,
        creatorUserName: f.creator?.name || null,
        avatarUrl: f.creator?.avatarUrl || f.creator?.profile?.avatarUrl || null,
        audienceCategories: (f.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (f.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (f.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (f.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };

      fundingData.matchPercentage = currentUserId ? calculateItemMatchPercentage(fundingData) : 20;
      return fundingData;
    };

    // Calculate match percentage between current user and an item
    const calculateItemMatchPercentage = (item) => {
      if (!currentUserId) return 20;

      const itemTaxonomies = {
        categories: (item.audienceCategories || []).map((c) => String(c.id)),
        subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
        subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
        identities: (item.audienceIdentities || []).map((i) => String(i.id)),
      };

      if (item.categoryId) itemTaxonomies.categories.push(String(item.categoryId));
      if (item.subcategoryId) itemTaxonomies.subcategories.push(String(item.subcategoryId));

      itemTaxonomies.categories = [...new Set(itemTaxonomies.categories)];
      itemTaxonomies.subcategories = [...new Set(itemTaxonomies.subcategories)];
      itemTaxonomies.subsubcategories = [...new Set(itemTaxonomies.subsubcategories)];
      itemTaxonomies.identities = [...new Set(itemTaxonomies.identities)];

      const REQUIRED_FACTORS = 3;
      const WEIGHTS = {
        category: 25,
        subcategory: 30,
        subsubcategory: 20,
        identity: 15,
        location: 10,
      };

      let totalScore = 0;
      let matchedFactors = 0;

      const allUserCategoryIds = [...new Set([...userDefaults.interestCategoryIds, ...effAudienceCategoryIds])];
      if (allUserCategoryIds.length && itemTaxonomies.categories.length) {
        const catMatches = itemTaxonomies.categories.filter((id) => allUserCategoryIds.includes(id));
        if (catMatches.length) {
          const pct = Math.min(1, catMatches.length / Math.max(allUserCategoryIds.length, itemTaxonomies.categories.length));
          totalScore += WEIGHTS.category * pct;
          matchedFactors++;
        }
      }

      const allUserSubcategoryIds = [...new Set([...userDefaults.interestSubcategoryIds, ...effAudienceSubcategoryIds])];
      if (allUserSubcategoryIds.length && itemTaxonomies.subcategories.length) {
        const subMatches = itemTaxonomies.subcategories.filter((id) => allUserSubcategoryIds.includes(id));
        if (subMatches.length) {
          const pct = Math.min(1, subMatches.length / Math.max(allUserSubcategoryIds.length, itemTaxonomies.subcategories.length));
          totalScore += WEIGHTS.subcategory * pct;
          matchedFactors++;
        }
      }

      const allUserSubsubCategoryIds = [...new Set([...userDefaults.interestSubsubCategoryIds, ...effAudienceSubsubCategoryIds])];
      if (allUserSubsubCategoryIds.length && itemTaxonomies.subsubcategories.length) {
        const xMatches = itemTaxonomies.subsubcategories.filter((id) => allUserSubsubCategoryIds.includes(id));
        if (xMatches.length) {
          const pct = Math.min(1, xMatches.length / Math.max(allUserSubsubCategoryIds.length, itemTaxonomies.subsubcategories.length));
          totalScore += WEIGHTS.subsubcategory * pct;
          matchedFactors++;
        }
      }

      const allUserIdentityIds = [...new Set([...userDefaults.interestIdentityIds, ...effAudienceIdentityIds])];
      if (allUserIdentityIds.length && itemTaxonomies.identities.length) {
        const idMatches = itemTaxonomies.identities.filter((id) => allUserIdentityIds.includes(id));
        if (idMatches.length) {
          const pct = Math.min(1, idMatches.length / Math.max(allUserIdentityIds.length, itemTaxonomies.identities.length));
          totalScore += WEIGHTS.identity * pct;
          matchedFactors++;
        }
      }

      const itemCity = (item.city || item.location || "").toLowerCase();
      if (userDefaults.city && itemCity && itemCity === userDefaults.city.toLowerCase()) {
        totalScore += WEIGHTS.location * 0.6;
        matchedFactors++;
      } else if (
        userDefaults.city &&
        itemCity &&
        (itemCity.includes(userDefaults.city.toLowerCase()) ||
          userDefaults.city.toLowerCase().includes(itemCity))
      ) {
        totalScore += WEIGHTS.location * 0.3;
        matchedFactors++;
      } else if (userDefaults.country && item.country === userDefaults.country) {
        totalScore += WEIGHTS.location * 0.4;
        matchedFactors++;
      }

      if (matchedFactors < REQUIRED_FACTORS) {
        const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }

      return Math.max(20, Math.min(100, Math.round(totalScore)));
    };

    // ---------------- Enhanced Scoring with Prioritization ----------------
    const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
    const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
    const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
    const interestIdSet = new Set(userDefaults.interestIdentityIds || []);

    const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
    const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);
    const attrXSet = new Set(userDefaults.attributeSubsubCategoryIds || []);
    const attrIdSet = new Set(userDefaults.attributeIdentityIds || []);

    const userCity = (userDefaults.city || "").toLowerCase();
    const userCountry = userDefaults.country || null;

    const Wscore = {
      interestX: 50,
      interestSub: 40,
      interestCat: 30,
      interestId: 20,
      attrX: 5,
      attrSub: 4,
      attrCat: 3,
      attrId: 2.5,
      exactCity: 2,
      partialCity: 1,
      country: 1,
      completeness: 0.5,
      recency: 2,
    };

    const scoreItem = (x) => {
      let s = 0;

      const subId = String(x.subcategoryId || "");
      const catId = String(x.categoryId || "");
      const xId = String(x.subsubcategoryId || "");

      const audienceCatIds = (x.audienceCategories || []).map((c) => String(c.id)).filter(Boolean);
      const audienceSubIds = (x.audienceSubcategories || []).map((c) => String(c.id)).filter(Boolean);
      const audienceXIds = (x.audienceSubsubs || []).map((c) => String(c.id)).filter(Boolean);
      const audienceIdIds = (x.audienceIdentities || []).map((c) => String(c.id)).filter(Boolean);

      const allCatIds = catId ? [catId, ...audienceCatIds] : audienceCatIds;
      const allSubIds = subId ? [subId, ...audienceSubIds] : audienceSubIds;
      const allXIds = xId ? [xId, ...audienceXIds] : audienceXIds;

      let hasInterestMatch = false;

      if (interestCatSet.size > 0) {
        const catMatches = allCatIds.filter((id) => interestCatSet.has(id));
        if (catMatches.length > 0) {
          s += Wscore.interestCat * 2;
          hasInterestMatch = true;
        }
      }
      if (interestSubSet.size > 0) {
        const subMatches = allSubIds.filter((id) => interestSubSet.has(id));
        if (subMatches.length > 0) {
          s += Wscore.interestSub;
          hasInterestMatch = true;
        }
      }
      if (interestXSet.size > 0) {
        const xMatches = allXIds.filter((id) => interestXSet.has(id));
        if (xMatches.length > 0) {
          s += Wscore.interestX;
          hasInterestMatch = true;
        }
      }
      if (interestIdSet.size > 0) {
        const idMatches = audienceIdIds.filter((id) => interestIdSet.has(id));
        if (idMatches.length > 0) {
          s += Wscore.interestId;
          hasInterestMatch = true;
        }
      }
      if (hasInterestMatch) s += 100;

      if (attrXSet.size > 0 && allXIds.some((id) => attrXSet.has(id))) s += Wscore.attrX;
      if (attrSubSet.size > 0 && allSubIds.some((id) => attrSubSet.has(id))) s += Wscore.attrSub;
      if (attrCatSet.size > 0 && allCatIds.some((id) => attrCatSet.has(id))) s += Wscore.attrCat;
      if (attrIdSet.size > 0 && audienceIdIds.some((id) => attrIdSet.has(id))) s += Wscore.attrId;

      if (hasTextSearch && x._textMatch) s += 5;

      if (catId && subId) s += Wscore.completeness;
      if (catId && subId && xId) s += Wscore.completeness;

      const itemCity = (x.city || x.location || "").toLowerCase();
      if (userCity && itemCity && itemCity === userCity) s += Wscore.exactCity;
      else if (
        userCity &&
        itemCity &&
        (itemCity.includes(userCity) || userCity.includes(itemCity)) &&
        itemCity !== userCity
      )
        s += Wscore.partialCity;

      if (userCountry && x.country === userCountry) s += Wscore.country;

      const now = new Date();
      const itemDate = new Date(x.createdAt);
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 14) s += Wscore.recency * (1 - daysDiff / 14);

      return s;
    };

    // ---------------- Flows ----------------
    // (A) No user → filters only; still compute match % (default 20) then sort by match % and diversify
    if (!currentUserId) {
      console.log("No user logged in, using filters only");

      if (tab === "events") {
        const events = await Event.findAll({
          subQuery: false,
          where: whereEvent,
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const mapped = events.map(mapEvent);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      if (tab === "jobs") {
        const jobs = await Job.findAll({
          subQuery: false,
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
        const mapped = jobs.map((j) => mapJob(j, companyMap));
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      if (tab === "services") {
        const services = await Service.findAll({
          subQuery: false,
          where: whereService,
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const mapped = services.map(mapService);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      if (tab === "products") {
        const products = await Product.findAll({
          subQuery: false,
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const mapped = products.map(mapProduct);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      if (tab === "tourism") {
        const tourism = await Tourism.findAll({
          subQuery: false,
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const mapped = tourism.map(mapTourism);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      if (tab === "funding") {
        const funding = await Funding.findAll({
          subQuery: false,
          where: whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const mapped = funding.map(mapFunding);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      // ---------- All (no user): build a larger buffer, sort by match %, diversify, then window ----------
      const [
        jobsAll,
        eventsAll,
        servicesAll,
        productsAll,
        tourismAll,
        fundingAll,
      ] = await Promise.all([
        Job.findAll({
          subQuery: false,
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Event.findAll({
          subQuery: false,
          where: whereEvent,
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Service.findAll({
          subQuery: false,
          where: whereService,
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Product.findAll({
          subQuery: false,
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Tourism.findAll({
          subQuery: false,
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Funding.findAll({
          subQuery: false,
          where: categoryId ? { ...whereFunding, categoryId } : whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
      ]);

      const applyTextMatchFlag = (items) => {
        if (!hasTextSearch) return items;
        return items.map((item) => {
          const itemText = [
            item.title,
            item.description,
            item.companyName,
            item.city,
            item.location,
            item.pitch,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const matches = searchTerms.some((term) => itemText.includes(term.toLowerCase()));
          return { ...item, _textMatch: matches };
        });
      };

      const companyMap = await makeCompanyMapById(jobsAll.map((j) => j.companyId));

      const merged = [
        ...applyTextMatchFlag(jobsAll.map((j) => mapJob(j, companyMap))),
        ...applyTextMatchFlag(eventsAll.map(mapEvent)),
        ...applyTextMatchFlag(servicesAll.map(mapService)),
        ...applyTextMatchFlag(productsAll.map(mapProduct)),
        ...applyTextMatchFlag(tourismAll.map(mapTourism)),
        ...applyTextMatchFlag(fundingAll.map(mapFunding)),
      ];

      // Primary: match %, Secondary: recency
      sortByMatchThenRecency(merged);

      // Diversify so you don't get long runs of the same kind
      const diversified = diversifyFeed(merged, { maxSeq: 1 });
      const windowed = diversified.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // (B) User is logged in → apply filters first, compute match %, sort by match %, diversify for "All"
    const bufferFactor = 3;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        subQuery: false,
        where: whereEvent,
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const mapped = events.map(mapEvent);
      // still compute additional score if needed (not used in ordering now)
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "jobs") {
      const jobs = await Job.findAll({
        subQuery: false,
        where: whereJob,
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
      const mapped = jobs.map((j) => mapJob(j, companyMap));
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "services") {
      const services = await Service.findAll({
        subQuery: false,
        where: whereService,
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const mapped = services.map(mapService);
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "products") {
      const products = await Product.findAll({
        subQuery: false,
        where: whereProduct,
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const mapped = products.map(mapProduct);
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "tourism") {
      const tourism = await Tourism.findAll({
        subQuery: false,
        where: whereTourism,
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const mapped = tourism.map(mapTourism);
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "funding") {
      const funding = await Funding.findAll({
        subQuery: false,
        where: whereFunding,
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const mapped = funding.map(mapFunding);
      mapped.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(mapped);
      const windowed = mapped.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // ---------- "All" tab (logged-in): buffer, map, compute match %, sort by match %, diversify, window ----------
    const [
      jobsBuf,
      eventsBuf,
      servicesBuf,
      productsBuf,
      tourismBuf,
      fundingBuf,
    ] = await Promise.all([
      Job.findAll({
        subQuery: false,
        where: whereJob,
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Event.findAll({
        subQuery: false,
        where: whereEvent,
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Service.findAll({
        subQuery: false,
        where: whereService,
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Product.findAll({
        subQuery: false,
        where: whereProduct,
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Tourism.findAll({
        subQuery: false,
        where: whereTourism,
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Funding.findAll({
        subQuery: false,
        where: whereFunding,
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
    ]);

    const applyTextMatchFlag = (items) => {
      if (!hasTextSearch) return items;
      return items.map((item) => {
        const itemText = [
          item.title,
          item.description,
          item.companyName,
          item.city,
          item.location,
          item.pitch,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matches = searchTerms.some((term) => itemText.includes(term.toLowerCase()));
        return { ...item, _textMatch: matches };
      });
    };

    const companyMap = await makeCompanyMapById(jobsBuf.map((j) => j.companyId));

    const mergedScored = [
      ...applyTextMatchFlag(jobsBuf.map((j) => mapJob(j, companyMap))),
      ...applyTextMatchFlag(eventsBuf.map(mapEvent)),
      ...applyTextMatchFlag(servicesBuf.map(mapService)),
      ...applyTextMatchFlag(productsBuf.map(mapProduct)),
      ...applyTextMatchFlag(tourismBuf.map(mapTourism)),
      ...applyTextMatchFlag(fundingBuf.map(mapFunding)),
    ].map((x) => ({ ...x, _score: scoreItem(x) })); // _score kept for debugging/secondary uses

    // Primary: match %, Secondary: recency
    sortByMatchThenRecency(mergedScored);

    // Diversify so you don't get long runs of the same kind
    const diversified = diversifyFeed(mergedScored, { maxSeq: 1 });

    const windowed = diversified.slice(off, off + lim);

    return res.json({ items: await getConStatusItems(windowed) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get feed" });
  }
};

// ---------------- Suggestions (improved) ----------------
function normalizeToArray(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [v];
}

// Improved scoring weights for different match types
const W = {
  x: 3,
  sub: 2.5,
  cat: 2,
  id: 1.5,
  city: 1.5,
  country: 1,
};

exports.getSuggestions = async (req, res) => {
  try {
    const {
      q,
      country: qCountry,
      city: qCity,
      categoryId,
      cats,
      subcategoryId,
      limit = 10,
    } = req.query;

    const like = (v) => ({ [Op.like]: `%${v}%` });

    const currentUserId = req.user?.id || null;

    let userDefaults = {
      country: null,
      city: null,
      categoryIds: [],
      subcategoryIds: [],
      subsubcategoryIds: [],
      identityIds: [],
    };

    if (currentUserId) {
      try {
        const me = await User.findByPk(currentUserId, {
          attributes: ["id", "country", "city", "accountType"],
          include: [{ model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] }],
        });
        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;
          userDefaults.categoryIds = (me.interests || []).map((i) => i.categoryId).filter(Boolean);
          userDefaults.subcategoryIds = (me.interests || []).map((i) => i.subcategoryId).filter(Boolean);
          userDefaults.subsubcategoryIds = [];
          userDefaults.identityIds = [];
        }
      } catch (error) {
        console.error("Error loading user data for suggestions:", error);
      }
    }

    const qCats = normalizeToArray(cats) || normalizeToArray(categoryId);
    const qSubcats = normalizeToArray(subcategoryId);

    const eff = {
      country: qCountry ?? userDefaults.country ?? null,
      city: qCity ?? userDefaults.city ?? null,
      categoryIds: qCats ? qCats : userDefaults.categoryIds.length ? userDefaults.categoryIds : null,
      subcategoryIds: qSubcats ? qSubcats : userDefaults.subcategoryIds.length ? userDefaults.subcategoryIds : null,
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

    const profileInclude = {
      model: Profile,
      as: "profile",
      attributes: ["professionalTitle", "about", "avatarUrl"],
      required: false,
    };

    const hasExplicitFilter = Boolean(q || qCountry || qCity || qCats || qSubcats);

    let matchesRaw = [];

    if (hasExplicitFilter) {
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, makeInterestsInclude(Boolean(qCats || qSubcats))],
        limit: Number(limit),
        order: [["createdAt", "DESC"]],
      });
    } else if (currentUserId) {
      if (userDefaults.categoryIds.length || userDefaults.subcategoryIds.length) {
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, makeInterestsInclude(true)],
          limit: Number(limit),
          order: [["createdAt", "DESC"]],
        });
      }
      if (!matchesRaw || matchesRaw.length === 0) {
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, makeInterestsInclude(false)],
          limit: Number(limit),
          order: [["createdAt", "DESC"]],
        });
      }
    } else {
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, makeInterestsInclude(false)],
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
      include: [profileInclude, makeInterestsInclude(Boolean(qCats || qSubcats))],
      limit: Number(limit),
      order: [["createdAt", "DESC"]],
    });

    const calculateMatchPercentage = (myWant, u) => {
      const other = {
        xs: (u.interests || []).map((i) => i.subsubcategoryId).filter(Boolean).map(String),
        subs: (u.interests || []).map((i) => i.subcategoryId).filter(Boolean).map(String),
        cats: (u.interests || []).map((i) => i.categoryId).filter(Boolean).map(String),
        ids: (u.interests || []).map((i) => i.identityId).filter(Boolean).map(String),
      };

      const REQUIRED_FACTORS = 4;
      const WEIGHTS = {
        category: 20,
        subcategory: 25,
        subsubcategory: 15,
        identity: 10,
        country: 15,
        city: 15,
      };

      let totalScore = 0;
      let matchedFactors = 0;

      if (myWant.catSet.size > 0 && other.cats.length > 0) {
        const catMatches = other.cats.filter((id) => myWant.catSet.has(id));
        if (catMatches.length > 0) {
          const pct = Math.min(1, catMatches.length / Math.max(myWant.catSet.size, other.cats.length));
          totalScore += WEIGHTS.category * pct;
          matchedFactors++;
        }
      }

      if (myWant.subSet.size > 0 && other.subs.length > 0) {
        const subMatches = other.subs.filter((id) => myWant.subSet.has(id));
        if (subMatches.length > 0) {
          const pct = Math.min(1, subMatches.length / Math.max(myWant.subSet.size, other.subs.length));
          totalScore += WEIGHTS.subcategory * pct;
          matchedFactors++;
        }
      }

      if (myWant.xSet.size > 0 && other.xs.length > 0) {
        const xMatches = other.xs.filter((id) => myWant.xSet.has(id));
        if (xMatches.length > 0) {
          const pct = Math.min(1, xMatches.length / Math.max(myWant.xSet.size, other.xs.length));
          totalScore += WEIGHTS.subsubcategory * pct;
          matchedFactors++;
        }
      }

      if (myWant.idSet.size > 0 && other.ids.length > 0) {
        const idMatches = other.ids.filter((id) => myWant.idSet.has(id));
        if (idMatches.length > 0) {
          const pct = Math.min(1, idMatches.length / Math.max(myWant.idSet.size, other.ids.length));
          totalScore += WEIGHTS.identity * pct;
          matchedFactors++;
        }
      }

      const hisCity = (u.city || "").toLowerCase();
      if (myWant.city && hisCity && myWant.city === hisCity) {
        totalScore += WEIGHTS.city;
        matchedFactors++;
      }

      const hisCountry = u.countryOfResidence || u.country || null;
      if (myWant.country && hisCountry && myWant.country === hisCountry) {
        totalScore += WEIGHTS.country;
        matchedFactors++;
      }

      if (matchedFactors < REQUIRED_FACTORS) {
        const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }

      return Math.max(0, Math.min(100, Math.round(totalScore)));
    };

    const mapUser = (u, idx) => {
      const professionalTitle = u.profile?.professionalTitle || null;

      let matchPercentage = 0;
      if (currentUserId) {
        const myWant = {
          xSet: new Set(userDefaults.subsubcategoryIds?.map(String) || []),
          subSet: new Set(userDefaults.subcategoryIds?.map(String) || []),
          catSet: new Set(userDefaults.categoryIds?.map(String) || []),
          idSet: new Set(userDefaults.identityIds?.map(String) || []),
          city: (userDefaults.city || "").toLowerCase(),
          country: userDefaults.country,
        };
        matchPercentage = calculateMatchPercentage(myWant, u);
      }

      const interests = u.interests || [];
      const cats = interests.map((it) => it.category?.name).filter(Boolean);
      const subcats = interests.map((it) => it.subcategory?.name).filter(Boolean);

      return {
        id: u.id,
        name: u.name,
        role: professionalTitle,
        tag: professionalTitle || cats[0] || "",
        avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
        city: u.city || null,
        country: u.country || null,
        email: u.email,
        cats: cats,
        subcats: subcats,
        matchPercentage,
        percentMatch: matchPercentage,
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
        connectionStatus: statusMap[u.id] || (currentUserId ? "none" : "unauthenticated"),
      }));

    const hasExplicitFilters = Boolean(qCountry || qCity || qCats || qSubcats);
    console.log(`Has explicit filters: ${hasExplicitFilters}`);

    matches = decorate(matches).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );
    nearby = decorate(nearby).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );

    if (!hasExplicitFilters) {
      const matchesBefore = matches.length;
      const nearbyBefore = nearby.length;
      matches = matches.filter((i) => i.matchPercentage > 0);
      nearby = nearby.filter((i) => i.matchPercentage > 0);
      console.log(`Filtered out ${matchesBefore - matches.length} matches with 0% match`);
      console.log(`Filtered out ${nearbyBefore - nearby.length} nearby with 0% match`);
    }

    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    nearby.sort((a, b) => b.matchPercentage - a.matchPercentage);

    if (matches.length > 0) {
      console.log(
        "Sample match percentages:",
        matches.slice(0, 3).map((m) => ({
          name: m.name,
          matchPercentage: m.matchPercentage,
          percentMatch: m.percentMatch,
        }))
      );
    }
    if (nearby.length > 0) {
      console.log(
        "Sample nearby percentages:",
        nearby.slice(0, 3).map((n) => ({
          name: n.name,
          matchPercentage: n.matchPercentage,
          percentMatch: n.percentMatch,
        }))
      );
    }

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
