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
  UserIdentityInterest
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

// Enhanced includes for jobs with audience associations
const includeCategoryRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
  {
    model: User,
    as: "postedBy",
    attributes: ["id", "name", "avatarUrl"],
    include: [
      { model: Profile, as: "profile", attributes: ["avatarUrl"] }
    ]
  },
  // Audience associations
  {
    model: Category,
    as: "audienceCategories",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: Subcategory,
    as: "audienceSubcategories",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: SubsubCategory,
    as: "audienceSubsubs",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: Identity,
    as: "audienceIdentities",
    attributes: ["id", "name"],
    through: { attributes: [] }
  }
];

const includeEventRefs = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
  { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
  { model: User, as: "organizer", attributes: ["id", "name"] },
  // Audience associations
  {
    model: Category,
    as: "audienceCategories",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: Subcategory,
    as: "audienceSubcategories",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: SubsubCategory,
    as: "audienceSubsubs",
    attributes: ["id", "name"],
    through: { attributes: [] }
  },
  {
    model: Identity,
    as: "audienceIdentities",
    attributes: ["id", "name"],
    through: { attributes: [] }
  }
];

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
    // Direct associations
    { model: Category, as: "category", attributes: ["id", "name"] },
    { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
    { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
    // Audience associations
    {
      model: Category,
      as: "audienceCategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: categoryId ? true : false,
      where: categoryId ? { id: categoryId } : undefined
    },
    {
      model: Subcategory,
      as: "audienceSubcategories",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: subcategoryId ? true : false,
      where: subcategoryId ? { id: subcategoryId } : undefined
    },
    {
      model: SubsubCategory,
      as: "audienceSubsubs",
      attributes: ["id", "name"],
      through: { attributes: [] },
      required: subsubCategoryId ? true : false,
      where: subsubCategoryId ? { id: subsubCategoryId } : undefined
    },
    {
      model: Identity,
      as: "audienceIdentities",
      attributes: ["id", "name"],
      through: { attributes: [] }
    }
  ];
}

// [PRODUCT] include → seller + audience M2M with enhanced associations
function makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }) {
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
    }
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };
  if (subsubCategoryId) include[3] = { ...include[3], required: true, where: { id: subsubCategoryId } };

  return include;
}

// [TOURISM] include → author + audience M2M with enhanced associations
function makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }) {
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
    }
  ];

  if (categoryId) include[1] = { ...include[1], required: true, where: { id: categoryId } };
  if (subcategoryId) include[2] = { ...include[2], required: true, where: { id: subcategoryId } };
  if (subsubCategoryId) include[3] = { ...include[3], required: true, where: { id: subsubCategoryId } };

  return include;
}

// [FUNDING] include → creator + direct category + audience M2M with enhanced associations
function makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }) {
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
    }
  ];

  // We'll filter with a WHERE using `$audienceCategories.id$` / `$audienceSubcategories.id$` OR direct `categoryId`
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
      subsubCategoryId,
      identityId,
      limit = 20,
      offset = 0,
    } = req.query;
    
    console.log("Feed request:", { tab, q, country, city, categoryId, subcategoryId, subsubCategoryId, identityId });
    
    // Improved text search handling
    let searchTerms = [];
    if (q) {
      // Split search terms and filter out terms that are too short
      searchTerms = q.split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length >= 2); // Reduced minimum length to 2 characters
    }

    const lim = pickNumber(limit) ?? 20;
    const off = pickNumber(offset) ?? 0;

    const isFilterActive = Boolean(
      country || city || categoryId || subcategoryId || subsubCategoryId || identityId
    );
    
    // Treat text search separately to allow it to work with interest-based prioritization
    const hasTextSearch = Boolean(q && searchTerms.length > 0);
    const currentUserId = req.user?.id || null;

    // Enhanced user defaults to distinguish between interests and attributes
    let userDefaults = {
      country: null,
      city: null,
      // What the user is looking for (interests)
      interestCategoryIds: [],
      interestSubcategoryIds: [],
      interestSubsubCategoryIds: [],
      interestIdentityIds: [],
      // What the user is (attributes)
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: [],
    };

    if (currentUserId) {
      try {
        // First, get basic user info and attributes (what the user is)
        const me = await User.findByPk(currentUserId, {
          attributes: ["id", "country", "city", "accountType"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["categoryId", "subcategoryId"],
              required: false,
            },
            // What the user is (attributes)
            {
              model: UserCategory,
              as: "interests",
              attributes: ["categoryId", "subcategoryId"],
            }
          ],
        });

        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;

          // Extract what the user is (attributes)
          const attributeCats = (me.interests || [])
            .map((i) => i.categoryId)
            .filter(Boolean);
          const attributeSubs = (me.interests || [])
            .map((i) => i.subcategoryId)
            .filter(Boolean);

          // Add profile attributes
          if (me.profile?.categoryId) attributeCats.push(me.profile.categoryId);
          if (me.profile?.subcategoryId) attributeSubs.push(me.profile.subcategoryId);

          // Store unique IDs for attributes
          userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
          userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));
          
          // Now try to get interest data (what the user is looking for)
          // Initialize empty arrays for all interest types
          userDefaults.interestCategoryIds = [];
          userDefaults.interestSubcategoryIds = [];
          userDefaults.interestSubsubCategoryIds = [];
          userDefaults.interestIdentityIds = [];
          
          try {
            // Get category interests
            const categoryInterests = await UserCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Category, as: "category", attributes: ["id", "name"] }]
            });
            
            userDefaults.interestCategoryIds = categoryInterests
              .map(i => i.categoryId)
              .filter(Boolean);
          } catch (error) {
            console.log("Category interests not available:", error.message);
          }
          
          try {
            // Get subcategory interests
            const subcategoryInterests = await UserSubcategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }]
            });
            
            userDefaults.interestSubcategoryIds = subcategoryInterests
              .map(i => i.subcategoryId)
              .filter(Boolean);
          } catch (error) {
            console.log("Subcategory interests not available:", error.message);
          }
          
          try {
            // Get subsubcategory interests
            const subsubInterests = await UserSubsubCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }]
            });
            
            userDefaults.interestSubsubCategoryIds = subsubInterests
              .map(i => i.subsubCategoryId)
              .filter(Boolean);
          } catch (error) {
            console.log("Subsubcategory interests not available:", error.message);
          }
          
          try {
            // Get identity interests
            const identityInterests = await UserIdentityInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }]
            });
            
            userDefaults.interestIdentityIds = identityInterests
              .map(i => i.identityId)
              .filter(Boolean);
          } catch (error) {
            console.log("Identity interests not available:", error.message);
          }
          
          console.log("User interests loaded:", {
            categories: userDefaults.interestCategoryIds,
            subcategories: userDefaults.interestSubcategoryIds,
            subsubcategories: userDefaults.interestSubsubCategoryIds,
            identities: userDefaults.interestIdentityIds
          });
        }
      } catch (error) {
        console.error("Error loading user data:", error);
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

    // Apply taxonomy filters
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
    if (subsubCategoryId) {
      whereJob.subsubCategoryId = subsubCategoryId;
      whereEvent.subsubCategoryId = subsubCategoryId;
      // products/tourism/funding via M2M
    }

    // Enhanced text search with multiple term support
    if (hasTextSearch) {
      // For each entity type, create an array of conditions for each search term
      whereJob[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { companyName: like(term) },
        { city: like(term) },
      ]);
      
      whereEvent[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { city: like(term) },
      ]);
      
      whereService[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { city: like(term) },
      ]);
      
      whereProduct[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
      ]);
      
      whereTourism[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { location: like(term) },
      ]);
      
      whereFunding[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { pitch: like(term) },
        { city: like(term) },
      ]);
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
    if (subsubCategoryId) {
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        { "$audienceSubsubs.id$": subsubCategoryId },
      ];
    }
    if (identityId) {
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        { "$audienceIdentities.id$": identityId },
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

    // ---------------- Enhanced Scoring with Prioritization ----------------
    // Create sets for efficient lookups
    // Interest sets (what the user is looking for) - higher priority
    const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
    const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
    const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
    const interestIdSet = new Set(userDefaults.interestIdentityIds || []);
    
    // Attribute sets (what the user is) - lower priority
    const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
    const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);
    const attrXSet = new Set(userDefaults.attributeSubsubCategoryIds || []);
    const attrIdSet = new Set(userDefaults.attributeIdentityIds || []);
    
    console.log("Interest sets:", {
      categories: Array.from(interestCatSet),
      subcategories: Array.from(interestSubSet),
      subsubcategories: Array.from(interestXSet),
      identities: Array.from(interestIdSet)
    });
    
    const userCity = (userDefaults.city || "").toLowerCase();
    const userCountry = userDefaults.country || null;

    // Scoring weights - interests have higher weights than attributes
    const W = {
      // Interest weights (what user is looking for)
      interestX: 50,       // Subsubcategory interest match
      interestSub: 40,     // Subcategory interest match
      interestCat: 30,     // Category interest match
      interestId: 20,      // Identity interest match
      
      // Attribute weights (what user is)
      attrX: 5,            // Subsubcategory attribute match
      attrSub: 4,          // Subcategory attribute match
      attrCat: 3,          // Category attribute match
      attrId: 2.5,         // Identity attribute match
      
      // Location weights
      exactCity: 2,        // Exact city match
      partialCity: 1,      // Partial city match
      country: 1,          // Country match
      
      // Bonuses
      completeness: 0.5,   // Completeness bonus
      recency: 2           // Maximum recency bonus
    };

    // Enhanced scoring function with prioritization between interests and attributes
    const scoreItem = (x) => {
      let s = 0;
      
      // Extract IDs, ensuring they're strings for consistent comparison
      const subId = String(x.subcategoryId || '');
      const catId = String(x.categoryId || '');
      const xId = String(x.subsubcategoryId || '');
      
      // Get audience IDs if available (for M2M relationships)
      const audienceCatIds = (x.audienceCategories || []).map(c => String(c.id)).filter(Boolean);
      const audienceSubIds = (x.audienceSubcategories || []).map(c => String(c.id)).filter(Boolean);
      const audienceXIds = (x.audienceSubsubs || []).map(c => String(c.id)).filter(Boolean);
      const audienceIdIds = (x.audienceIdentities || []).map(c => String(c.id)).filter(Boolean);
      
      // Combine direct IDs with audience IDs
      const allCatIds = catId ? [catId, ...audienceCatIds] : audienceCatIds;
      const allSubIds = subId ? [subId, ...audienceSubIds] : audienceSubIds;
      const allXIds = xId ? [xId, ...audienceXIds] : audienceXIds;
      
      // Debug info
      console.log(`Scoring item: ${x.kind} - ${x.title} - catId: ${catId}, subId: ${subId}, xId: ${xId}`);
      console.log(`User interests: cats: ${Array.from(interestCatSet)}, subs: ${Array.from(interestSubSet)}`);
      
      // ---- INTEREST MATCHES (highest priority) ----
      let hasInterestMatch = false;
      let matchDetails = [];
      
      // Check for category interest match (most important for this fix)
      if (interestCatSet.size > 0) {
        const catMatches = allCatIds.filter(id => interestCatSet.has(id));
        if (catMatches.length > 0) {
          s += W.interestCat * 2; // Double the weight for category matches
          hasInterestMatch = true;
          matchDetails.push(`Category match: ${catMatches.join(', ')}`);
        }
      }
      
      // Check for subcategory interest match
      if (interestSubSet.size > 0) {
        const subMatches = allSubIds.filter(id => interestSubSet.has(id));
        if (subMatches.length > 0) {
          s += W.interestSub;
          hasInterestMatch = true;
          matchDetails.push(`Subcategory match: ${subMatches.join(', ')}`);
        }
      }
      
      // Check for subsubcategory interest match
      if (interestXSet.size > 0) {
        const xMatches = allXIds.filter(id => interestXSet.has(id));
        if (xMatches.length > 0) {
          s += W.interestX;
          hasInterestMatch = true;
          matchDetails.push(`Subsubcategory match: ${xMatches.join(', ')}`);
        }
      }
      
      // Check for identity interest match
      if (interestIdSet.size > 0) {
        const idMatches = audienceIdIds.filter(id => interestIdSet.has(id));
        if (idMatches.length > 0) {
          s += W.interestId;
          hasInterestMatch = true;
          matchDetails.push(`Identity match: ${idMatches.join(', ')}`);
        }
      }
      
      // Apply a boost if any interest match was found, but not so large that it overrides filters
      if (hasInterestMatch) {
        s += 100; // Boost for interest matches, but not enough to override explicit filters
        console.log(`Interest match found for ${x.kind} - ${x.title}: ${matchDetails.join('; ')}. Score: ${s}`);
      } else {
        console.log(`No interest match for ${x.kind} - ${x.title}`);
      }
      
      // ---- ATTRIBUTE MATCHES (lower priority) ----
      
      // Check for subsubcategory attribute match
      if (attrXSet.size > 0 && allXIds.some(id => attrXSet.has(id))) {
        s += W.attrX;
      }
      
      // Check for subcategory attribute match
      if (attrSubSet.size > 0 && allSubIds.some(id => attrSubSet.has(id))) {
        s += W.attrSub;
      }
      
      // Check for category attribute match
      if (attrCatSet.size > 0 && allCatIds.some(id => attrCatSet.has(id))) {
        s += W.attrCat;
      }
      
      // Check for identity attribute match
      if (attrIdSet.size > 0 && audienceIdIds.some(id => attrIdSet.has(id))) {
        s += W.attrId;
      }
      
      // Text search boost - if we're doing a text search and this item matches
      if (hasTextSearch && x._textMatch) {
        s += 5; // Boost for text matches, but less than interest matches
      }
      
      // Completeness bonus - reward well-categorized content
      if (catId && subId) s += W.completeness; // Has both category and subcategory
      if (catId && subId && xId) s += W.completeness; // Has complete taxonomy path
      
      // Improved location matching
      const itemCity = (x.city || x.location || "").toLowerCase();
      
      // Exact city match
      if (userCity && itemCity && itemCity === userCity) {
        s += W.exactCity;
      }
      // Partial city name matching (city contains or is contained in)
      else if (userCity && itemCity &&
              (itemCity.includes(userCity) || userCity.includes(itemCity)) &&
              itemCity !== userCity) {
        s += W.partialCity;
      }
      
      // Country match
      if (userCountry && x.country === userCountry) s += W.country;
      
      // Recency bonus - extend from 7 to 14 days for more gradual decay
      const now = new Date();
      const itemDate = new Date(x.createdAt);
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 14) {
        // Linear decay from max recency bonus (today) to 0 (14 days old)
        s += W.recency * (1 - daysDiff / 14);
      }
      
      return s;
    };

    // ---------------- Flows ----------------
    // SIMPLIFIED FLOW:
    // 1. If user is not logged in, just use filters and sort by date
    // 2. If user is logged in, always use scoring to prioritize content based on interests
    
    // (A) No user → use filters only and sort by date
    if (!currentUserId) {
      console.log("No user logged in, using filters only");
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
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(services.map(mapService)) });
      }

      if (tab === "products") {
        const products = await Product.findAll({
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(products.map(mapProduct)) });
      }

      if (tab === "tourism") {
        const tourism = await Tourism.findAll({
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        return res.json({ items: await getConStatusItems(tourism.map(mapTourism)) });
      }

      // [FUNDING] tab
      if (tab === "funding") {
        const funding = await Funding.findAll({
          subQuery: Boolean(categoryId || subcategoryId || subsubCategoryId || identityId), // needed for $audience...$ filtering
          where: whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
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
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Product.findAll({
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Tourism.findAll({
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Funding.findAll({
          subQuery: Boolean(categoryId || subcategoryId || subsubCategoryId || identityId),
          where: whereFunding,
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
      ]);

      // Apply text search flag to items that match the search terms
      const applyTextMatchFlag = (items) => {
        if (!hasTextSearch) return items;
        
        return items.map(item => {
          // Check if this item matches any search term
          const itemText = [
            item.title,
            item.description,
            item.companyName,
            item.city,
            item.location,
            item.pitch
          ].filter(Boolean).join(' ').toLowerCase();
          
          const matches = searchTerms.some(term =>
            itemText.includes(term.toLowerCase())
          );
          
          return { ...item, _textMatch: matches };
        });
      };
      
      const merged = [
        ...applyTextMatchFlag(jobsAll.map(mapJob)),
        ...applyTextMatchFlag(eventsAll.map(mapEvent)),
        ...applyTextMatchFlag(servicesAll.map(mapService)),
        ...applyTextMatchFlag(productsAll.map(mapProduct)),
        ...applyTextMatchFlag(tourismAll.map(mapTourism)),
        ...applyTextMatchFlag(fundingAll.map(mapFunding)),
      ];
      
      // If we have text search, score and sort the items
      if (hasTextSearch && currentUserId) {
        const scored = merged.map(x => ({ ...x, _score: scoreItem(x) }));
        scored.sort((a, b) =>
          b._score - a._score ||
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        const windowed = scored.slice(off, off + lim).map(({ _score, _textMatch, ...rest }) => rest);
        return res.json({ items: await getConStatusItems(windowed) });
      }
      
      // Otherwise just sort by date
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const windowed = merged.slice(off, off + lim);
      return res.json({ items: await getConStatusItems(windowed) });
    }

    // (B) User is logged in → apply filters first, then use prioritization (score)
    // This ensures filters have absolute priority
    const bufferFactor = 3;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        where: whereEvent,
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      
      console.log(`Found ${events.length} events with applied filters`);
      
      // Map events to the format expected by the client
      const mappedEvents = events.map(mapEvent);
      
      // Score events based on user interests
      const scored = mappedEvents.map((x) => ({ ...x, _score: scoreItem(x) }));
      
      // Sort by score and then by date
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
        where: whereJob,
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
        where: whereService,
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
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
        where: whereProduct,
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
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
        where: whereTourism,
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
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
        subQuery: Boolean(categoryId || subcategoryId || subsubCategoryId || identityId),
        where: whereFunding,
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
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

    // "All" tab with filters applied first
    const [jobsBuf, eventsBuf, servicesBuf, productsBuf, tourismBuf, fundingBuf] = await Promise.all([
      Job.findAll({
        where: whereJob,
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Event.findAll({
        where: whereEvent,
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Service.findAll({
        where: whereService,
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Product.findAll({
        where: whereProduct,
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Tourism.findAll({
        where: whereTourism,
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Funding.findAll({
        subQuery: Boolean(categoryId || subcategoryId || subsubCategoryId || identityId),
        where: whereFunding,
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
    ]);

    // Apply text match flag for text search
    const applyTextMatchFlag = (items) => {
      if (!hasTextSearch) return items;
      
      return items.map(item => {
        // Check if this item matches any search term
        const itemText = [
          item.title,
          item.description,
          item.companyName,
          item.city,
          item.location,
          item.pitch
        ].filter(Boolean).join(' ').toLowerCase();
        
        const matches = searchTerms.some(term =>
          itemText.includes(term.toLowerCase())
        );
        
        return { ...item, _textMatch: matches };
      });
    };
    
    const mergedScored = [
      ...applyTextMatchFlag(jobsBuf.map(mapJob)),
      ...applyTextMatchFlag(eventsBuf.map(mapEvent)),
      ...applyTextMatchFlag(servicesBuf.map(mapService)),
      ...applyTextMatchFlag(productsBuf.map(mapProduct)),
      ...applyTextMatchFlag(tourismBuf.map(mapTourism)),
      ...applyTextMatchFlag(fundingBuf.map(mapFunding)),
    ].map((x) => ({ ...x, _score: scoreItem(x) }));

    mergedScored.sort(
      (a, b) =>
        b._score - a._score ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const windowed = mergedScored
      .slice(off, off + lim)
      .map(({ _score, _textMatch, ...rest }) => rest);

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
  x: 3,        // Subsubcategory match weight
  sub: 2.5,     // Subcategory match weight
  cat: 2,       // Category match weight
  id: 1.5,      // Identity match weight
  city: 1.5,    // City match weight
  country: 1    // Country match weight
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
          include: [
            {
              model: UserCategory,
              as: "interests",
              attributes: ["categoryId", "subcategoryId"]
            },
          ],
        });
        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;
          userDefaults.categoryIds = (me.interests || []).map(i => i.categoryId).filter(Boolean);
          userDefaults.subcategoryIds = (me.interests || []).map(i => i.subcategoryId).filter(Boolean);
          
          // These might not be available in the current database schema
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
      categoryIds: qCats ? qCats : (userDefaults.categoryIds.length ? userDefaults.categoryIds : null),
      subcategoryIds: qSubcats ? qSubcats : (userDefaults.subcategoryIds.length ? userDefaults.subcategoryIds : null),
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
        include: [
          profileInclude,
          makeInterestsInclude(Boolean(qCats || qSubcats)),
        ],
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
      include: [
        profileInclude,
        makeInterestsInclude(Boolean(qCats || qSubcats)),
      ],
      limit: Number(limit),
      order: [["createdAt", "DESC"]],
    });

    // Calculate match percentage between current user and another user
    const calculateMatchPercentage = (myWant, u) => {
      // Extract other user's taxonomies
      const other = {
        xs: (u.interests || [])
          .map(i => i.subsubcategoryId)
          .filter(Boolean)
          .map(String),
        subs: (u.interests || [])
          .map(i => i.subcategoryId)
          .filter(Boolean)
          .map(String),
        cats: (u.interests || [])
          .map(i => i.categoryId)
          .filter(Boolean)
          .map(String),
        ids: (u.interests || [])
          .map(i => i.identityId)
          .filter(Boolean)
          .map(String)
      };

      // Improved scoring for suggestions with better weights
      // Count matches for more accurate percentage
      let matchCount = 0;
      let possibleMatches = 0;
      
      // Only count possible matches for taxonomies that exist
      possibleMatches += myWant.xSet.size > 0 && other.xs.length > 0 ? 1 : 0;
      possibleMatches += myWant.subSet.size > 0 && other.subs.length > 0 ? 1 : 0;
      possibleMatches += myWant.catSet.size > 0 && other.cats.length > 0 ? 1 : 0;
      possibleMatches += myWant.idSet.size > 0 && other.ids.length > 0 ? 1 : 0;
      possibleMatches += myWant.city && u.city ? 1 : 0;
      possibleMatches += myWant.country && (u.countryOfResidence || u.country) ? 1 : 0;
      
      // If no possible matches, ensure we don't divide by zero
      if (possibleMatches === 0) possibleMatches = 1;
      
      let s = 0;
      if (other.xs.some(id => myWant.xSet.has(id))) {
        s += W.x;
        matchCount++;
      }
      if (other.subs.some(id => myWant.subSet.has(id))) {
        s += W.sub;
        matchCount++;
      }
      if (other.cats.some(id => myWant.catSet.has(id))) {
        s += W.cat;
        matchCount++;
      }
      if (other.ids.some(id => myWant.idSet.has(id))) {
        s += W.id;
        matchCount++;
      }

      const hisCity = (u.city || "").toLowerCase();
      const hisCountry = u.countryOfResidence || u.country || null;

      if (myWant.city && hisCity && myWant.city === hisCity) {
        s += W.city;
        matchCount++;
      }
      if (myWant.country && hisCountry && myWant.country === hisCountry) {
        s += W.country;
        matchCount++;
      }

      // Calculate percentage based on actual matches vs possible matches
      // Ensure it's a number from 0 to 100
      const pct = Math.round((matchCount / possibleMatches) * 100);
      return Math.max(0, Math.min(100, pct));
    };

    const mapUser = (u, idx) => {
      // Get professional info
      const professionalTitle = u.profile?.professionalTitle || null;
      
      // Prepare user's taxonomies for matching
      let matchPercentage = 0;
      
      if (currentUserId) {
        // Create sets for efficient matching
        const myWant = {
          xSet: new Set(userDefaults.subsubcategoryIds?.map(String) || []),
          subSet: new Set(userDefaults.subcategoryIds?.map(String) || []),
          catSet: new Set(userDefaults.categoryIds?.map(String) || []),
          idSet: new Set(userDefaults.identityIds?.map(String) || []),
          city: (userDefaults.city || "").toLowerCase(),
          country: userDefaults.country
        };
        
        // Calculate match percentage
        matchPercentage = calculateMatchPercentage(myWant, u);
      }
      
      // Extract categories and subcategories
      const interests = u.interests || [];
      const cats = interests.map(it => it.category?.name).filter(Boolean);
      const subcats = interests.map(it => it.subcategory?.name).filter(Boolean);
      
      return {
        id: u.id,
        name: u.name,
        role: professionalTitle,
        tag: professionalTitle || cats[0] || "", // Use professional title or first category as tag
        avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
        city: u.city || null,
        country: u.country || null,
        email: u.email,
        cats: cats,
        subcats: subcats,
        matchPercentage: matchPercentage, // Ensure this is a number from 0-100
        percentMatch: matchPercentage, // Add an additional field with clearer naming
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

    // Check if any filters are applied
    const hasExplicitFilters = Boolean(qCountry || qCity || qCats || qSubcats);
    console.log(`Has explicit filters: ${hasExplicitFilters}`);
    
    // Apply connection status filter
    matches = decorate(matches)
      .filter(i => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated");
    
    nearby = decorate(nearby)
      .filter(i => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated");
    
    // Only filter out 0% matches when no filters are applied
    if (!hasExplicitFilters) {
      const matchesBeforeFilter = matches.length;
      const nearbyBeforeFilter = nearby.length;
      
      matches = matches.filter(i => i.matchPercentage > 0);
      nearby = nearby.filter(i => i.matchPercentage > 0);
      
      console.log(`Filtered out ${matchesBeforeFilter - matches.length} matches with 0% match`);
      console.log(`Filtered out ${nearbyBeforeFilter - nearby.length} nearby with 0% match`);
    }
    
    // Sort by match percentage (highest first)
    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    nearby.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    console.log(`Returning ${matches.length} matches and ${nearby.length} nearby users, sorted by match percentage`);

    // Log some sample match percentages for debugging
    if (matches.length > 0) {
      console.log("Sample match percentages:", matches.slice(0, 3).map(m => ({
        name: m.name,
        matchPercentage: m.matchPercentage,
        percentMatch: m.percentMatch
      })));
    }
    
    if (nearby.length > 0) {
      console.log("Sample nearby percentages:", nearby.slice(0, 3).map(n => ({
        name: n.name,
        matchPercentage: n.matchPercentage,
        percentMatch: n.percentMatch
      })));
    }
    
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
