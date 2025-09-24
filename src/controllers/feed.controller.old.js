// src/controllers/feed.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  Job,
  Event,
  Need,
  Moment,
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
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
  UserSettings,
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
function hasTextContent(item) {
  return Boolean(item.description && item.description.trim().length > 0);
}
function hasImageContent(item) {
  const imageFields = ['coverImage', 'coverImageBase64', 'coverImageUrl', 'images', 'attachments'];
  for (const field of imageFields) {
    if (item[field]) {
      if (Array.isArray(item[field]) && item[field].length > 0) return true;
      if (typeof item[field] === 'string' && item[field].trim().length > 0) {
        if (item[field].startsWith('data:image/') && item[field].length < 100) continue;
        return true;
      }
    }
  }
  return false;
}
function applyContentTypeFilter(items, contentType) {
  if (contentType === 'all') return items;
  return items.filter(item => {
    const hasText = hasTextContent(item);
    const hasImages = hasImageContent(item);
    if (contentType === 'text') return hasText && !hasImages;
    if (contentType === 'images') return hasImages;
    return true;
  });
}
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
  { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
  { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
  { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
  {
    model: User,
    as: "organizer",
    attributes: ["id", "name", "avatarUrl"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
  },
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

const includeNeedRefs = [
  {
    model: User,
    as: "user",
    attributes: ["id", "name", "avatarUrl"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
  },
  { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
  { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
  { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
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
    { model: Category, as: "category", attributes: ["id", "name"] },
    { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
    { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"] },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"] },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"] },
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

function makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "seller",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
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

function makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "author",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
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

function makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "user",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
    { model: IndustryCategory, as: "industryCategory", attributes: ["id", "name"], required: false },
    { model: IndustrySubcategory, as: "industrySubcategory", attributes: ["id", "name"], required: false },
    { model: IndustrySubsubCategory, as: "industrySubsubCategory", attributes: ["id", "name"], required: false },
    { model: GeneralCategory, as: "generalCategory", attributes: ["id", "name"], required: false },
    { model: GeneralSubcategory, as: "generalSubcategory", attributes: ["id", "name"], required: false },
    { model: GeneralSubsubCategory, as: "generalSubsubCategory", attributes: ["id", "name"], required: false },
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
  if (categoryId) include[3] = { ...include[3], required: true, where: { id: categoryId } };
  if (subcategoryId) include[4] = { ...include[4], required: true, where: { id: subcategoryId } };
  if (subsubCategoryId) include[5] = { ...include[5], required: true, where: { id: subsubCategoryId } };
  return include;
}

function makeFundingInclude() {
  return [
    {
      model: User,
      as: "creator",
      attributes: ["id", "name", "avatarUrl"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"] }],
    },
    { model: Category, as: "category", attributes: ["id", "name"], required: false },
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


function sortByMatchThenRecency(arr) {
  return arr.sort((a, b) => {
    const am = Number.isFinite(a.matchPercentage) ? a.matchPercentage : (Number(a._score) || 0);
    const bm = Number.isFinite(b.matchPercentage) ? b.matchPercentage : (Number(b._score) || 0);
    if (bm !== am) return bm - am; // higher matchPercentage (or _score) first
    const ad = new Date(a.createdAt).getTime() || 0;
    const bd = new Date(b.createdAt).getTime() || 0;
    return bd - ad; // tie-break by recency
  });
}


function diversifyFeed(items, { maxSeq = 1 } = {}) {
  const pool = items.slice();
  const out = [];
  let lastKind = null;
  let streak = 0;
  while (pool.length) {
    let pickIdx = pool.findIndex((it) => {
      if (!lastKind) return true;
      if (it.kind !== lastKind) return true;
      return streak < maxSeq;
    });
    if (pickIdx === -1) pickIdx = 0;
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

async function fetchMomentsPaged({ where, include, limit, offset, order = [["createdAt", "DESC"]] }) {
  const whereIds = { ...(where || {}), moderation_status: "approved" };
  const idRows = await Moment.findAll({
    where: whereIds,
    attributes: ["id", "createdAt"],
    order,
    limit: limit ?? 40,
    offset: offset ?? 0,
    raw: true,
  });
  const ids = idRows.map((r) => r.id);
  if (!ids.length) return [];
  const rows = await Moment.findAll({
    where: { id: { [Op.in]: ids } },
    include,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  return rows;
}

function normalizeToArray(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [v];
}

const W = { x: 3, sub: 2.5, cat: 2, id: 1.5, city: 1.5, country: 1 };

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
      industryIds,
      generalCategoryIds,
      generalSubcategoryIds,
      generalSubsubCategoryIds,
      audienceIdentityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,
      price,
      serviceType,
      priceType,
      deliveryTime,
      experienceLevel,
      locationType,
      jobType,
      workMode,
      workLocation,
      workSchedule,
      careerLevel,
      paymentType,
      jobsView,
      postType,
      season,
      budgetRange,
      fundingGoal,
      amountRaised,
      deadline,
      date,
      eventType,
      registrationType,
      limit = 20,
      offset = 0,
    } = req.query;

    const tabToEntityTypeMap = {
      jobs: "job",
      events: "event",
      services: "service",
      products: "product",
      tourism: "tourism",
      funding: "funding",
      needs: "need",
      moments: "moment",
    };
    const relatedEntityType = tabToEntityTypeMap[tab];

    const cities = ensureArray(city);
    const currentUserId = req.user?.id || null;

    let userSettings = null;
    let connectionsOnly = false;
    let contentType = 'all';
    let connectedUserIds = [];

    if (currentUserId) {
      try {
        userSettings = await UserSettings.findOne({
          where: { userId: currentUserId },
          attributes: ['connectionsOnly', 'contentType']
        });
        connectionsOnly = userSettings?.connectionsOnly || false;
        contentType = userSettings?.contentType || 'all';
        if (connectionsOnly) {
          const connections = await Connection.findAll({
            where: {
              [Op.or]: [
                { userOneId: currentUserId },
                { userTwoId: currentUserId }
              ]
            },
            attributes: ['userOneId', 'userTwoId']
          });
          connectedUserIds = connections.flatMap(conn =>
            conn.userOneId === currentUserId ? [conn.userTwoId] : [conn.userOneId]
          );
        }
      } catch {}
    }

    const effIndustryIds = ensureArray(industryIds).filter(Boolean);

    let searchTerms = [];
    if (q) {
      searchTerms = q.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);
    }

    const lim = pickNumber(limit) ?? 20;
    const off = pickNumber(offset) ?? 0;

    const effAudienceIdentityIds = ensureArray(audienceIdentityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);

    const effGeneralCategoryIds = ensureArray(generalCategoryIds).filter(Boolean);
    const effGeneralSubcategoryIds = ensureArray(generalSubcategoryIds).filter(Boolean);
    const effGeneralSubsubCategoryIds = ensureArray(generalSubsubCategoryIds).filter(Boolean);

    const effAudienceIdentityIdsStr = effAudienceIdentityIds.map(String);
    const effAudienceCategoryIdsStr = effAudienceCategoryIds.map(String);
    const effAudienceSubcategoryIdsStr = effAudienceSubcategoryIds.map(String);
    const effAudienceSubsubCategoryIdsStr = effAudienceSubsubCategoryIds.map(String);

    const effGeneralCategoryIdsStr = effGeneralCategoryIds.map(String);
    const effGeneralSubcategoryIdsStr = effGeneralSubcategoryIds.map(String);
    const effGeneralSubsubCategoryIdsStr = effGeneralSubsubCategoryIds.map(String);

    const hasTextSearch = Boolean(q && searchTerms.length > 0);

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

    let userDefaults = {
      country: null,
      city: null,
      interestCategoryIds: [],
      interestSubcategoryIds: [],
      interestSubsubCategoryIds: [],
      interestIdentityIds: [],
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
          } catch {}

          try {
            const subcategoryInterests = await UserSubcategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubcategoryIds = subcategoryInterests.map((i) => i.subcategoryId).filter(Boolean);
          } catch {}

          try {
            const subsubInterests = await UserSubsubCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubsubCategoryIds = subsubInterests.map((i) => i.subsubCategoryId).filter(Boolean);
          } catch {}

          try {
            const identityInterests = await UserIdentityInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }],
            });
            userDefaults.interestIdentityIds = identityInterests.map((i) => i.identityId).filter(Boolean);
          } catch {}
        }
      } catch {}
    }

    const countries = ensureArray(country);

    const createFlexibleLocationFilter = () => {
      const filter = {};
      const countryExact = countries.length ? [{ country: { [Op.in]: countries } }] : [];
      const cityLikes = buildOrLikes("city", cities);
      const cityInCountryField = buildOrLikes("country", cities);
      const countryInCityField = buildOrLikes("city", countries);
      const orParts = [];
      if (countries.length && cities.length) {
        orParts.push(...countryExact, ...cityLikes, ...countryInCityField, ...cityInCountryField);
      } else if (countries.length) {
        orParts.push(...countryExact, ...cityInCountryField);
      } else if (cities.length) {
        orParts.push(...cityLikes, ...cityInCountryField);
      }
      if (orParts.length) {
        filter[Op.or] = orParts;
      }
      return filter;
    };

    const whereCommon = createFlexibleLocationFilter();
    const whereJob = { ...whereCommon };
    const whereEvent = { ...whereCommon };
    const whereService = { ...whereCommon };
    const whereNeed = { ...whereCommon };

    if (effGeneralCategoryIds.length > 0) {
      whereService.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereService.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereService.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    if (effGeneralCategoryIds.length > 0) {
      whereNeed.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereNeed.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereNeed.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    if (effGeneralCategoryIds.length > 0) {
      whereEvent.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereEvent.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereEvent.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    const whereProduct = {};
    const productOr = [];
    if (countries.length) productOr.push({ country: { [Op.in]: countries } });
    if (cities.length) productOr.push(...buildOrLikes("country", cities));
    if (productOr.length) whereProduct[Op.or] = productOr;
    if (price) whereProduct.price = { [Op.lte]: Number(price) };
    if (effGeneralCategoryIds.length > 0) whereProduct.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereProduct.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereProduct.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    const whereTourism = {};
    const tourismOr = [];
    if (countries.length) {
      tourismOr.push({ country: { [Op.in]: countries } });
      tourismOr.push(...buildOrLikes("location", countries));
    }
    if (cities.length) {
      tourismOr.push(...buildOrLikes("location", cities));
      tourismOr.push(...buildOrLikes("country", cities));
    }
    if (tourismOr.length) whereTourism[Op.or] = tourismOr;
    if (effGeneralCategoryIds.length > 0) whereTourism.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereTourism.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereTourism.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    const whereFunding = createFlexibleLocationFilter();
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
      whereNeed.userId = { [Op.notIn]: excludedUserIds };
    }

    if (fundingGoal) whereFunding.goal = { [Op.lte]: Number(fundingGoal) };
    if (amountRaised) whereFunding.raised = { [Op.gte]: Number(amountRaised) };
    if (deadline) whereFunding.deadline = { [Op.gte]: deadline };

    if (categoryId) {
      whereJob.categoryId = categoryId;
      whereEvent.categoryId = categoryId;
      whereNeed.categoryId = categoryId;
    }
    if (subcategoryId) {
      whereJob.subcategoryId = subcategoryId;
      whereEvent.subcategoryId = subcategoryId;
      whereNeed.subcategoryId = subcategoryId;
    }
    if (subsubCategoryId) {
      whereJob.subsubCategoryId = subsubCategoryId;
      whereEvent.subsubCategoryId = subsubCategoryId;
      whereNeed.subsubCategoryId = subsubCategoryId;
    }

    if (connectionsOnly && connectedUserIds.length > 0) {
      whereJob.postedByUserId = { [Op.in]: connectedUserIds };
      whereEvent.organizerUserId = { [Op.in]: connectedUserIds };
      whereService.providerUserId = { [Op.in]: connectedUserIds };
      whereProduct.sellerUserId = { [Op.in]: connectedUserIds };
      whereTourism.authorUserId = { [Op.in]: connectedUserIds };
      whereFunding.creatorUserId = { [Op.in]: connectedUserIds };
      whereNeed.userId = { [Op.in]: connectedUserIds };
      whereCommon.userId = { [Op.in]: connectedUserIds };
    }

    if (effIndustryIds.length > 0) {
      whereJob.industryCategoryId = { [Op.in]: effIndustryIds };
      whereEvent.industryCategoryId = { [Op.in]: effIndustryIds };
      whereService.industryCategoryId = { [Op.in]: effIndustryIds };
      whereProduct.industryCategoryId = { [Op.in]: effIndustryIds };
      whereTourism.industryCategoryId = { [Op.in]: effIndustryIds };
      whereFunding.industryCategoryId = { [Op.in]: effIndustryIds };
      whereNeed.industryCategoryId = { [Op.in]: effIndustryIds };
    }

    if (effAudienceIdentityIdsStr.length > 0) {
      const f = { "$audienceIdentities.id$": { [Op.in]: effAudienceIdentityIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
      whereNeed[Op.and] = [...(whereNeed[Op.and] || []), f];
    }
    if (effAudienceCategoryIdsStr.length > 0) {
      const f = { "$audienceCategories.id$": { [Op.in]: effAudienceCategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
      whereNeed[Op.and] = [...(whereNeed[Op.and] || []), f];
    }
    if (effAudienceSubcategoryIdsStr.length > 0) {
      const f = { "$audienceSubcategories.id$": { [Op.in]: effAudienceSubcategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
      whereNeed[Op.and] = [...(whereNeed[Op.and] || []), f];
    }
    if (effAudienceSubsubCategoryIdsStr.length > 0) {
      const f = { "$audienceSubsubs.id$": { [Op.in]: effAudienceSubsubCategoryIdsStr } };
      whereJob[Op.and] = [...(whereJob[Op.and] || []), f];
      whereEvent[Op.and] = [...(whereEvent[Op.and] || []), f];
      whereService[Op.and] = [...(whereService[Op.and] || []), f];
      whereProduct[Op.and] = [...(whereProduct[Op.and] || []), f];
      whereTourism[Op.and] = [...(whereTourism[Op.and] || []), f];
      whereFunding[Op.and] = [...(whereFunding[Op.and] || []), f];
      whereNeed[Op.and] = [...(whereNeed[Op.and] || []), f];
    }

    if (jobType) {
      const jobTypes = jobType.split(",").filter(Boolean);
      if (jobTypes.length) whereJob.jobType = { [Op.in]: jobTypes };
    }
    if (workMode) {
      const workModes = workMode.split(",").filter(Boolean);
      if (workModes.length) whereJob.workMode = { [Op.in]: workModes };
    }
    if (workLocation) {
      const workLocations = workLocation.split(",").filter(Boolean);
      if (workLocations.length) whereJob.workLocation = { [Op.in]: workLocations };
    }
    if (workSchedule) {
      const workSchedules = workSchedule.split(",").filter(Boolean);
      if (workSchedules.length) whereJob.workSchedule = { [Op.in]: workSchedules };
    }
    if (careerLevel) {
      const careerLevels = careerLevel.split(",").filter(Boolean);
      if (careerLevels.length) whereJob.careerLevel = { [Op.in]: careerLevels };
    }
    if (paymentType) {
      const paymentTypes = paymentType.split(",").filter(Boolean);
      if (paymentTypes.length) whereJob.paymentType = { [Op.in]: paymentTypes };
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

    if (eventType) {
      const ets = eventType.split(",").filter(Boolean);
      if (ets.length) whereEvent.eventType = { [Op.in]: ets };
    }
    if (date) whereEvent.date = { [Op.gte]: date };
    if (registrationType) {
      const rts = registrationType.split(",").filter(Boolean);
      if (rts.length) whereEvent.registrationType = { [Op.in]: rts };
    }

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
      whereNeed[Op.or] = [
        ...(whereNeed[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
    }

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
    if (effIndustryIds.length > 0) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ industryCategoryId: { [Op.in]: effIndustryIds } });
    }

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
            : it.kind === "need"
            ? it.userId
            : it.kind === "moment"
            ? it.userId
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
            : it.kind === "need"
            ? it.userId
            : it.kind === "moment"
            ? it.userId
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
      jobData.matchPercentage = calculateItemMatchPercentage(jobData);
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
        _debug_fields: null,
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
              if (typeof value === "string" && value.startsWith("Url")) value = value.substring(3);
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
            if (typeof value === "string" && value.startsWith("Url")) value = value.substring(3);
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
      eventData.matchPercentage = calculateItemMatchPercentage(eventData);
      return eventData;
    };

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
      serviceData.matchPercentage = calculateItemMatchPercentage(serviceData);
      return serviceData;
    };

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
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(p.tags)) parsedTags = p.tags;
        else if (typeof p.tags === "string") parsedTags = JSON.parse(p.tags || "[]");
      } catch {}
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
      productData.matchPercentage = calculateItemMatchPercentage(productData);
      return productData;
    };

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
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(t.tags)) parsedTags = t.tags;
        else if (typeof t.tags === "string") parsedTags = JSON.parse(t.tags || "[]");
      } catch {}
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
      tourismData.matchPercentage = calculateItemMatchPercentage(tourismData);
      return tourismData;
    };

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
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(f.tags)) parsedTags = f.tags;
        else if (typeof f.tags === "string") parsedTags = JSON.parse(f.tags || "[]");
      } catch {}
      let parsedLinks = [];
      try {
        if (Array.isArray(f.links)) parsedLinks = f.links;
        else if (typeof f.links === "string") parsedLinks = JSON.parse(f.links || "[]");
      } catch {}
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
      fundingData.matchPercentage = calculateItemMatchPercentage(fundingData);
      return fundingData;
    };

    const calculateItemMatchPercentage = (item) => {
      if (!currentUserId) {
        const WEIGHTS = { category: 25, subcategory: 25, subsubcategory: 20, goal: 15, identity: 15, location: 20, text: 10, experienceLevel: 10 };
        let totalScore = 0, matchedFactors = 0;
        const itemTaxonomies = {
          categories: (item.audienceCategories || []).map((c) => String(c.id)),
          subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
          subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
          identities: (item.audienceIdentities || []).map((i) => String(i.id)),
          goals: [],
          directCategory: item.categoryId ? String(item.categoryId) : null,
          directSubcategory: item.subcategoryId ? String(item.subcategoryId) : null,
          directSubsubCategory: item.subsubCategoryId ? String(item.subsubCategoryId) : null,
          generalCategory: item.generalCategoryId ? String(item.generalCategoryId) : null,
          generalSubcategory: item.generalSubcategoryId ? String(item.generalSubcategoryId) : null,
          generalSubsubCategory: item.generalSubsubCategoryId ? String(item.generalSubsubCategoryId) : null,
          industryCategory: item.industryCategoryId ? String(item.industryCategoryId) : null,
          industrySubcategory: item.industrySubcategoryId ? String(item.industrySubcategoryId) : null,
          industrySubsubCategory: item.industrySubsubCategoryId ? String(item.industrySubsubCategoryId) : null,
        };
        if (itemTaxonomies.directCategory) itemTaxonomies.categories.push(itemTaxonomies.directCategory);
        if (itemTaxonomies.directSubcategory) itemTaxonomies.subcategories.push(itemTaxonomies.directSubcategory);
        if (itemTaxonomies.directSubsubCategory) itemTaxonomies.subsubcategories.push(itemTaxonomies.directSubsubCategory);
        itemTaxonomies.categories = [...new Set(itemTaxonomies.categories)];
        itemTaxonomies.subcategories = [...new Set(itemTaxonomies.subcategories)];
        itemTaxonomies.subsubcategories = [...new Set(itemTaxonomies.subsubcategories)];
        itemTaxonomies.identities = [...new Set(itemTaxonomies.identities)];
        if (effAudienceCategoryIds.length && itemTaxonomies.categories.length) {
          const catMatches = itemTaxonomies.categories.filter((id) => effAudienceCategoryIds.includes(id));
          if (catMatches.length) {
            const pct = Math.min(1, catMatches.length / effAudienceCategoryIds.length);
            totalScore += WEIGHTS.category * pct; matchedFactors++;
          }
        }
        if (effAudienceSubcategoryIds.length && itemTaxonomies.subcategories.length) {
          const subMatches = itemTaxonomies.subcategories.filter((id) => effAudienceSubcategoryIds.includes(id));
          if (subMatches.length) {
            const pct = Math.min(1, subMatches.length / effAudienceSubcategoryIds.length);
            totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
          }
        }
        if (effAudienceSubsubCategoryIds.length && itemTaxonomies.subsubcategories.length) {
          const xMatches = itemTaxonomies.subsubcategories.filter((id) => effAudienceSubsubCategoryIds.includes(id));
          if (xMatches.length) {
            const pct = Math.min(1, xMatches.length / effAudienceSubsubCategoryIds.length);
            totalScore += WEIGHTS.subsubcategory * pct; matchedFactors++;
          }
        }
        if (hasTextSearch) {
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
          if (matches) {
            totalScore += WEIGHTS.text;
            matchedFactors++;
          }
        }
        let locationScore = 0;
        const itemCity = (item.city || item.location || "").toLowerCase();
        if (cities.length && itemCity) {
          const cityMatches = cities.some(city => itemCity.includes(city.toLowerCase()) || city.toLowerCase().includes(itemCity));
          if (cityMatches) locationScore += 0.4;
        }
        if (countries.length && item.country) {
          if (countries.includes(item.country)) locationScore += 0.6;
        }
        if (locationScore) { totalScore += WEIGHTS.location * locationScore; matchedFactors++; }
        if (experienceLevel) {
          const filteredLevels = experienceLevel.split(",").filter(Boolean);
          if (item.experienceLevel && filteredLevels.includes(item.experienceLevel)) {
            totalScore += WEIGHTS.experienceLevel;
            matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralCategoryIds) && effGeneralCategoryIds.length && itemTaxonomies.generalCategory) {
          if (effGeneralCategoryIds.map(String).includes(itemTaxonomies.generalCategory)) {
            totalScore += 25; matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralSubcategoryIds) && effGeneralSubcategoryIds.length && itemTaxonomies.generalSubcategory) {
          if (effGeneralSubcategoryIds.map(String).includes(itemTaxonomies.generalSubcategory)) {
            totalScore += 30; matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralSubsubCategoryIds) && effGeneralSubsubCategoryIds.length && itemTaxonomies.generalSubsubCategory) {
          if (effGeneralSubsubCategoryIds.map(String).includes(itemTaxonomies.generalSubsubCategory)) {
            totalScore += 20; matchedFactors++;
          }
        }
        if (Array.isArray(effIndustryIds) && effIndustryIds.length && itemTaxonomies.industryCategory) {
          if (effIndustryIds.map(String).includes(itemTaxonomies.industryCategory)) {
            totalScore += 35; matchedFactors++;
          }
        }
        return Math.max(0, Math.min(100, Math.round(totalScore)));
      }

      const itemTaxonomies = {
        categories: (item.audienceCategories || []).map((c) => String(c.id)),
        subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
        subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
        identities: (item.audienceIdentities || []).map((i) => String(i.id)),
        directCategory: item.categoryId ? String(item.categoryId) : null,
        directSubcategory: item.subcategoryId ? String(item.subcategoryId) : null,
        directSubsubCategory: item.subsubCategoryId ? String(item.subsubCategoryId) : null,
        generalCategory: item.generalCategoryId ? String(item.generalCategoryId) : null,
        generalSubcategory: item.generalSubcategoryId ? String(item.generalSubcategoryId) : null,
        generalSubsubCategory: item.generalSubsubCategoryId ? String(item.generalSubsubCategoryId) : null,
        industryCategory: item.industryCategoryId ? String(item.industryCategoryId) : null,
        industrySubcategory: item.industrySubcategoryId ? String(item.industrySubcategoryId) : null,
        industrySubsubCategory: item.industrySubsubCategoryId ? String(item.industrySubsubCategoryId) : null,
      };

      if (itemTaxonomies.directCategory) itemTaxonomies.categories.push(itemTaxonomies.directCategory);
      if (itemTaxonomies.directSubcategory) itemTaxonomies.subcategories.push(itemTaxonomies.directSubcategory);
      if (itemTaxonomies.directSubsubCategory) itemTaxonomies.subsubcategories.push(itemTaxonomies.directSubsubCategory);

      itemTaxonomies.categories = [...new Set(itemTaxonomies.categories)];
      itemTaxonomies.subcategories = [...new Set(itemTaxonomies.subcategories)];
      itemTaxonomies.subsubcategories = [...new Set(itemTaxonomies.subsubcategories)];
      itemTaxonomies.identities = [...new Set(itemTaxonomies.identities)];

      const WEIGHTS = { category: 25, subcategory: 30, subsubcategory: 20, identity: 15, location: 10 };
      const GENERAL_WEIGHTS = { category: 10, subcategory: 12, subsubcategory: 8 };
      const INDUSTRY_WEIGHTS = { category: 15, subcategory: 10, subsubcategory: 8 };
      const REQUIRED_FACTORS = 3;

      let totalScore = 0;
      let matchedFactors = 0;

      const allUserCategoryIds = [...new Set([...userDefaults.interestCategoryIds, ...effAudienceCategoryIds])];
      if (allUserCategoryIds.length && itemTaxonomies.categories.length) {
        const catMatches = itemTaxonomies.categories.filter((id) => allUserCategoryIds.includes(id));
        if (catMatches.length) {
          const pct = Math.min(
            1,
            catMatches.length / Math.max(allUserCategoryIds.length, itemTaxonomies.categories.length)
          );
          totalScore += WEIGHTS.category * pct;
          matchedFactors++;
        }
      }

      const allUserSubcategoryIds = [...new Set([...userDefaults.interestSubcategoryIds, ...effAudienceSubcategoryIds])];
      if (allUserSubcategoryIds.length && itemTaxonomies.subcategories.length) {
        const subMatches = itemTaxonomies.subcategories.filter((id) => allUserSubcategoryIds.includes(id));
        if (subMatches.length) {
          const pct = Math.min(
            1,
            subMatches.length / Math.max(allUserSubcategoryIds.length, itemTaxonomies.subcategories.length)
          );
          totalScore += WEIGHTS.subcategory * pct;
          matchedFactors++;
        }
      }

      const allUserSubsubCategoryIds = [
        ...new Set([...userDefaults.interestSubsubCategoryIds, ...effAudienceSubsubCategoryIds]),
      ];
      if (allUserSubsubCategoryIds.length && itemTaxonomies.subsubcategories.length) {
        const xMatches = itemTaxonomies.subsubcategories.filter((id) => allUserSubsubCategoryIds.includes(id));
        if (xMatches.length) {
          const pct = Math.min(
            1,
            xMatches.length / Math.max(allUserSubsubCategoryIds.length, itemTaxonomies.subsubcategories.length)
          );
          totalScore += WEIGHTS.subsubcategory * pct;
          matchedFactors++;
        }
      }

      const allUserIdentityIds = [...new Set([...userDefaults.interestIdentityIds, ...effAudienceIdentityIds])];
      if (allUserIdentityIds.length && itemTaxonomies.identities.length) {
        const idMatches = itemTaxonomies.identities.filter((id) => allUserIdentityIds.includes(id));
        if (idMatches.length) {
          const pct = Math.min(
            1,
            idMatches.length / Math.max(allUserIdentityIds.length, itemTaxonomies.identities.length)
          );
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

      if (Array.isArray(effGeneralCategoryIds) && effGeneralCategoryIds.length && itemTaxonomies.generalCategory) {
        if (effGeneralCategoryIds.map(String).includes(itemTaxonomies.generalCategory)) {
          totalScore += GENERAL_WEIGHTS.category;
          matchedFactors++;
        }
      }
      if (
        Array.isArray(effGeneralSubcategoryIds) &&
        effGeneralSubcategoryIds.length &&
        itemTaxonomies.generalSubcategory
      ) {
        if (effGeneralSubcategoryIds.map(String).includes(itemTaxonomies.generalSubcategory)) {
          totalScore += GENERAL_WEIGHTS.subcategory;
          matchedFactors++;
        }
      }
      if (
        Array.isArray(effGeneralSubsubCategoryIds) &&
        effGeneralSubsubCategoryIds.length &&
        itemTaxonomies.generalSubsubCategory
      ) {
        if (effGeneralSubsubCategoryIds.map(String).includes(itemTaxonomies.generalSubsubCategory)) {
          totalScore += GENERAL_WEIGHTS.subsubcategory;
          matchedFactors++;
        }
      }

      if (Array.isArray(effIndustryIds) && effIndustryIds.length && itemTaxonomies.industryCategory) {
        if (effIndustryIds.map(String).includes(itemTaxonomies.industryCategory)) {
          totalScore += INDUSTRY_WEIGHTS.category;
          matchedFactors++;
        }
      }

      if (matchedFactors < REQUIRED_FACTORS) {
        const scalingFactor = Math.max(0.5, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }

      return Math.max(0, Math.min(100, Math.round(totalScore)));
    };


    const mapNeed = (n) => {
      const needData = {
        kind: "need",
        id: n.id,
        title: n.title,
        description: n.description,
        budget: n.budget,
        urgency: n.urgency,
        location: n.location,
        categoryId: n.generalCategoryId ? String(n.generalCategoryId) : "",
        categoryName: n.generalCategory?.name || "",
        subcategoryId: n.generalSubcategoryId ? String(n.generalSubcategoryId) : "",
        subcategoryName: n.generalSubcategory?.name || "",
        subsubCategoryId: n.generalSubsubCategoryId ? String(n.generalSubsubCategoryId) : "",
        subsubCategoryName: n.generalSubsubCategory?.name || "",
        city: n.city,
        relatedEntityType:n.relatedEntityType,
        country: n.country,
        createdAt: n.createdAt,
        timeAgo: timeAgo(n.createdAt),
        userId: n.userId || null,
        userName: n.user?.name || null,
        tags:n.criteria,
        userAvatarUrl: n.user?.avatarUrl || n.user?.profile?.avatarUrl || null,
        attachments: n.attachments
          ? typeof n.attachments === "string"
            ? JSON.parse(n.attachments || "[]")
            : Array.isArray(n.attachments)
            ? n.attachments
            : []
          : [],
        audienceCategories: (n.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (n.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (n.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (n.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
  
      needData.matchPercentage = calculateItemMatchPercentage(needData);
  
      return needData;
    };

    const mapMoment = (m) => {
      const picked = m;
      const user = picked.user || {};
      let parsedImages = [];
      try {
        if (Array.isArray(picked.images)) parsedImages = picked.images;
        else if (typeof picked.images === "string") parsedImages = JSON.parse(picked.images || "[]");
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(picked.tags)) parsedTags = picked.tags;
        else if (typeof picked.tags === "string") parsedTags = JSON.parse(picked.tags || "[]");
      } catch {}
      const momentData = {
        kind: "moment",
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        date: m.date,
        location: m.location,
        country: m.country,
        city: m.city,
        tags: parsedTags,
        images: parsedImages,
        categoryId: picked.generalCategoryId ? String(picked.generalCategoryId) : "",
        categoryName: picked.generalCategory?.name || "",
        subcategoryId: picked.generalSubcategoryId ? String(picked.generalSubcategoryId) : "",
        subcategoryName: picked.generalSubcategory?.name || "",
        subsubCategoryId: picked.generalSubsubCategoryId ? String(picked.generalSubsubCategoryId) : "",
        subsubCategoryName: picked.generalSubsubCategory?.name || "",
        createdAt: m.createdAt,
        timeAgo: timeAgo(m.createdAt),
        relatedEntityType:m.relatedEntityType,
        userId: m.userId || null,
        userName: user.name || null,
        avatarUrl: user.avatarUrl || user.profile?.avatarUrl || null,
        audienceCategories: (m.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (m.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (m.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (m.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      momentData.matchPercentage = calculateItemMatchPercentage(momentData);
      return momentData;
    };

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
        if (catMatches.length > 0) { s += Wscore.interestCat * 2; hasInterestMatch = true; }
      }
      if (interestSubSet.size > 0) {
        const subMatches = allSubIds.filter((id) => interestSubSet.has(id));
        if (subMatches.length > 0) { s += Wscore.interestSub; hasInterestMatch = true; }
      }
      if (interestXSet.size > 0) {
        const xMatches = allXIds.filter((id) => interestXSet.has(id));
        if (xMatches.length > 0) { s += Wscore.interestX; hasInterestMatch = true; }
      }
      if (interestIdSet.size > 0) {
        const idMatches = audienceIdIds.filter((id) => interestIdSet.has(id));
        if (idMatches.length > 0) { s += Wscore.interestId; hasInterestMatch = true; }
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
      else if (userCity && itemCity && (itemCity.includes(userCity) || userCity.includes(itemCity)) && itemCity !== userCity) s += Wscore.partialCity;
      if (userCountry && x.country === userCountry) s += Wscore.country;
      const now = new Date();
      const itemDate = new Date(x.createdAt);
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 14) s += Wscore.recency * (1 - daysDiff / 14);
      return s;
    };

    if (!currentUserId) {
      if (tab === "events") {
        const events = await Event.findAll({
          subQuery: false,
          where: { ...whereEvent, moderation_status: "approved" },
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'event', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "event" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedEvents = events.map(mapEvent);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const combined = [...mappedEvents, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "jobs") {
        const jobsViewOptions = jobsView ? ensureArray(jobsView) : [];
        const showJobOffers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Offers");
        const showJobSeekers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Seekers");
        let jobs = [];
        let relatedNeeds = [];
        let relatedMomentsRows = [];
        if (showJobOffers) {
          jobs = await Job.findAll({
            subQuery: false,
            where: { ...whereJob, moderation_status: "approved" },
            include: includeCategoryRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
            offset: off,
          });
        }
        if (showJobSeekers) {
          relatedNeeds = await Need.findAll({
            subQuery: false,
            where: { ...whereNeed, relatedEntityType: 'job', moderation_status: "approved" },
            include: includeNeedRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
            offset: off,
          });
          relatedMomentsRows = await fetchMomentsPaged({
            where: { ...whereCommon, relatedEntityType: "job" },
            include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
            limit: lim,
            offset: off,
          });
        }
        const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
        const mappedJobs = jobs.map((j) => mapJob(j, companyMap));
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedJobs, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "services") {
        const services = await Service.findAll({
          subQuery: false,
          where: { ...whereService, moderation_status: "approved" },
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'service', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "service" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedServices = services.map(mapService);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedServices, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "products") {
        const products = await Product.findAll({
          subQuery: false,
          where: { ...whereProduct, moderation_status: "approved" },
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'product', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "product" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedProducts = products.map(mapProduct);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedProducts, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "tourism") {
        const tourism = await Tourism.findAll({
          subQuery: false,
          where: { ...whereTourism, moderation_status: "approved" },
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'tourism', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "tourism" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedTourism = tourism.map(mapTourism);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedTourism, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "funding") {
        const funding = await Funding.findAll({
          subQuery: false,
          where: { ...whereFunding, moderation_status: "approved" },
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'funding', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "funding" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedFunding = funding.map(mapFunding);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedFunding, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "needs") {
        const needs = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "need" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mappedNeeds = needs.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return res.json({ items: await getConStatusItems(filtered) });
      }

      if (tab === "moments") {
        const momentsRows = await fetchMomentsPaged({
          where: { ...whereCommon },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        const mapped = momentsRows.map(mapMoment);
        sortByMatchThenRecency(mapped);
        return res.json({ items: await getConStatusItems(mapped) });
      }

      const [
        jobsAll,
        eventsAll,
        servicesAll,
        productsAll,
        tourismAll,
        fundingAll,
        needsAll,
        momentsAll,
      ] = await Promise.all([
        Job.findAll({
          subQuery: false,
          where: { ...whereJob, moderation_status: "approved" },
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Event.findAll({
          subQuery: false,
          where: { ...whereEvent, moderation_status: "approved" },
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Service.findAll({
          subQuery: false,
          where: { ...whereService, moderation_status: "approved" },
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Product.findAll({
          subQuery: false,
          where: { ...whereProduct, moderation_status: "approved" },
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Tourism.findAll({
          subQuery: false,
          where: { ...whereTourism, moderation_status: "approved" },
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Funding.findAll({
          subQuery: false,
          where: categoryId ? { ...whereFunding, categoryId, moderation_status: "approved" } : { ...whereFunding, moderation_status: "approved" },
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
        }),
        Need.findAll({
          subQuery: false,
          where: { ...whereNeed, moderation_status: "approved" },
          include: includeNeedRefs,
          limit: lim,
        }),
        fetchMomentsPaged({
          where: { ...whereCommon },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: 0,
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
        ...applyTextMatchFlag(needsAll.map(mapNeed)),
        ...applyTextMatchFlag(momentsAll.map(mapMoment)),
      ];

      sortByMatchThenRecency(merged);
      const diversified = diversifyFeed(merged, { maxSeq: 1 });
      const windowed = diversified.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    const bufferFactor = 2;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        subQuery: false,
        where: { ...whereEvent, moderation_status: "approved" },
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "event", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "event" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });
      const mappedEvents = events.map(mapEvent);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);
      const combined = [...mappedEvents, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "jobs") {
      const jobsViewOptions = jobsView ? ensureArray(jobsView) : [];
      const showJobOffers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Offers");
      const showJobSeekers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Seekers");

      let jobs = [];
      let relatedNeeds = [];
      let relatedMomentsRows = [];

      if (showJobOffers) {
        jobs = await Job.findAll({
          subQuery: false,
          where: { ...whereJob, moderation_status: "approved" },
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: bufferLimit,
        });
      }

      if (showJobSeekers) {
        relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: "job", moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: bufferLimit,
        });

        relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "job" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
          offset: 0,
        });
      }

      const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
      const mappedJobs = jobs.map((j) => mapJob(j, companyMap));
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);
      const combined = [...mappedJobs, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "services") {
      const services = await Service.findAll({
        subQuery: false,
        where: { ...whereService, moderation_status: "approved" },
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "service", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "service" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedServices = services.map(mapService);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedServices, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "products") {
      const products = await Product.findAll({
        subQuery: false,
        where: { ...whereProduct, moderation_status: "approved" },
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "product", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "product" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedProducts = products.map(mapProduct);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedProducts, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "tourism") {
      const tourism = await Tourism.findAll({
        subQuery: false,
        where: { ...whereTourism, moderation_status: "approved" },
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "tourism", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "tourism" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedTourism = tourism.map(mapTourism);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedTourism, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "funding") {
      const funding = await Funding.findAll({
        subQuery: false,
        where: { ...whereFunding, moderation_status: "approved" },
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "funding", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "funding" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedFunding = funding.map(mapFunding);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedFunding, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "needs") {
      const needs = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "need" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedNeeds = needs.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedNeeds, ...mappedMoments];
      const filtered = applyContentTypeFilter(combined, contentType);
      filtered.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(filtered);
      const windowed = filtered.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    if (tab === "moments") {
      const momentsRows = await fetchMomentsPaged({
        where: { ...whereCommon },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedMoments = momentsRows.map(mapMoment);
      const filtered = applyContentTypeFilter(mappedMoments, contentType);
      filtered.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(filtered);
      const windowed = filtered.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    const [
      jobsBuf,
      eventsBuf,
      servicesBuf,
      productsBuf,
      tourismBuf,
      fundingBuf,
      needsBuf,
      momentsBuf,
    ] = await Promise.all([
      Job.findAll({
        subQuery: false,
        where: { ...whereJob, moderation_status: "approved" },
        include: includeCategoryRefs,
        limit: bufferLimit,
      }),
      Event.findAll({
        subQuery: false,
        where: { ...whereEvent, moderation_status: "approved" },
        include: includeEventRefs,
        limit: bufferLimit,
      }),
      Service.findAll({
        subQuery: false,
        where: { ...whereService, moderation_status: "approved" },
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
      }),
      Product.findAll({
        subQuery: false,
        where: { ...whereProduct, moderation_status: "approved" },
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
      }),
      Tourism.findAll({
        subQuery: false,
        where: { ...whereTourism, moderation_status: "approved" },
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
      }),
      Funding.findAll({
        subQuery: false,
        where: { ...whereFunding, moderation_status: "approved" },
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
      }),
      Need.findAll({
        subQuery: false,
        where: { ...whereNeed, moderation_status: "approved" },
        include: includeNeedRefs,
        limit: bufferLimit,
      }),
      fetchMomentsPaged({
        where: { ...whereCommon },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
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

    const companyMap2 = await makeCompanyMapById(jobsBuf.map((j) => j.companyId));

    const mergedScored = [
      ...applyTextMatchFlag(jobsBuf.map((j) => mapJob(j, companyMap2))),
      ...applyTextMatchFlag(eventsBuf.map(mapEvent)),
      ...applyTextMatchFlag(servicesBuf.map(mapService)),
      ...applyTextMatchFlag(productsBuf.map(mapProduct)),
      ...applyTextMatchFlag(tourismBuf.map(mapTourism)),
      ...applyTextMatchFlag(fundingBuf.map(mapFunding)),
      ...applyTextMatchFlag(needsBuf.map(mapNeed)),
      ...applyTextMatchFlag(momentsBuf.map(mapMoment)),
    ];

    const contentFiltered = applyContentTypeFilter(mergedScored, contentType);
    const scored = contentFiltered.map((x) => ({ ...x, _score: scoreItem(x) }));
    sortByMatchThenRecency(scored);
    const diversified = diversifyFeed(scored, { maxSeq: 1 });
    const windowed = diversified.slice(off, off + lim);
    return res.json({ items: await getConStatusItems(windowed) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get feed" });
  }
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
      } catch {}
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
      const WEIGHTS = { category: 20, subcategory: 25, subsubcategory: 15, identity: 10, country: 15, city: 15 };

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

    matches = decorate(matches).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );
    nearby = decorate(nearby).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );

    if (!hasExplicitFilters) {
      matches = matches.filter((i) => i.matchPercentage > 0);
      nearby = nearby.filter((i) => i.matchPercentage > 0);
    }

    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    nearby.sort((a, b) => b.matchPercentage - a.matchPercentage);

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
