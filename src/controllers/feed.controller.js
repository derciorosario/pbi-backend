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
  {
    model: User,
    as: "organizer",
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
        { model: Profile, as: "profile", attributes: ["avatarUrl"] }
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
    {
      model: User,
      as: "seller",
      attributes: ["id", "name", "avatarUrl"],
      include: [
        { model: Profile, as: "profile", attributes: ["avatarUrl"] }
      ]
    },
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
    {
      model: User,
      as: "author",
      attributes: ["id", "name", "avatarUrl"],
      include: [
        { model: Profile, as: "profile", attributes: ["avatarUrl"] }
      ]
    },
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
    {
      model: User,
      as: "creator",
      attributes: ["id", "name", "avatarUrl"],
      include: [
        { model: Profile, as: "profile", attributes: ["avatarUrl"] }
      ]
    },
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
    
    console.log("Feed request:", {
      tab, q, country, city, categoryId, subcategoryId, subsubCategoryId, identityId,
      // Log audience filters
      audienceIdentityIds, audienceCategoryIds, audienceSubcategoryIds, audienceSubsubCategoryIds,
      // Log additional filters
      price, serviceType, priceType, deliveryTime, experienceLevel, locationType,
      jobType, workMode, postType, season, budgetRange, fundingGoal, amountRaised, deadline,
      eventType, date, registrationType
    });
    
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

    // Parse audience filter IDs
    const effAudienceIdentityIds = ensureArray(audienceIdentityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);
    
    // Convert to strings to ensure consistent comparison
    const effAudienceIdentityIdsStr = effAudienceIdentityIds.map(id => String(id));
    const effAudienceCategoryIdsStr = effAudienceCategoryIds.map(id => String(id));
    const effAudienceSubcategoryIdsStr = effAudienceSubcategoryIds.map(id => String(id));
    const effAudienceSubsubCategoryIdsStr = effAudienceSubsubCategoryIds.map(id => String(id));

    // Log audience filter parameters for debugging
    console.log("Audience filter parameters:", {
      identityIds: effAudienceIdentityIds,
      audienceCategoryIds: effAudienceCategoryIds,
      audienceSubcategoryIds: effAudienceSubcategoryIds,
      audienceSubsubCategoryIds: effAudienceSubsubCategoryIds
    });

    
    // Treat text search separately to allow it to work with interest-based prioritization
    const hasTextSearch = Boolean(q && searchTerms.length > 0);
    const currentUserId = req.user?.id || null;

    // Check if any explicit filters are applied
    const hasExplicitFilter = Boolean(
      country || city || categoryId || subcategoryId || subsubCategoryId || identityId ||
      // Audience filters
      effAudienceIdentityIds.length || effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length || effAudienceSubsubCategoryIds.length ||
      // Product filters
      price ||
      // Service filters
      serviceType || priceType || deliveryTime ||
      // Shared filters
      experienceLevel || locationType ||
      // Job filters
      jobType || workMode ||
      // Tourism filters
      postType || season || budgetRange ||
      // Funding filters
      fundingGoal || amountRaised || deadline ||
      // Event filters
      eventType || date || registrationType ||
      // Text search
      hasTextSearch
    );

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
    // Parse country as array to support multiple countries
    const countries = ensureArray(country);
    console.log("Countries filter:", countries);
    
    // Enhanced flexible location matching
    const createFlexibleLocationFilter = () => {
      const filter = {};
      
      // If both countries and city are provided, we'll use OR logic to match either
      if (countries.length > 0 && city) {
        filter[Op.or] = [
          // Direct country matches (any of the provided countries)
          { country: { [Op.in]: countries } },
          // City match
          { city: like(city) },
          
          // Cross matches (city value in country field or country values in city field)
          ...countries.map(c => ({ city: like(c) })),
        ];
      }
      // If only countries are provided
      else if (countries.length > 0) {
        filter[Op.or] = [
          // Direct country matches (any of the provided countries)
          { country: { [Op.in]: countries } },
          // Also match country names in city field
          ...countries.map(c => ({ city: like(c) })),
        ];
      }
      // If only city is provided
      else if (city) {
        filter[Op.or] = [
          { city: like(city) },
          { country: like(city) }, // Also match city name in country field
        ];
      }
      
      return filter;
    };
    
    // Create flexible location filters for each item type
    const whereCommon = createFlexibleLocationFilter();
    const whereJob = { ...whereCommon };
    const whereEvent = { ...whereCommon };
    const whereService = { ...whereCommon };
    
    // Products: Apply location matching (only country, no city field in Product model)
    const whereProduct = {};
    if (countries.length > 0) {
      whereProduct.country = { [Op.in]: countries };
    }
    if (price) {
      whereProduct.price = { [Op.lte]: Number(price) };
    }
    
    // Tourism: Apply flexible location matching with location field
    const whereTourism = {};
    if (countries.length > 0 && city) {
      whereTourism[Op.or] = [
        // Direct country matches
        { country: { [Op.in]: countries } },
        // Location matches
        { location: like(city) },
        // Cross matches
        { country: like(city) },
        ...countries.map(c => ({ location: like(c) })),
      ];
    } else if (countries.length > 0) {
      whereTourism[Op.or] = [
        // Direct country matches
        { country: { [Op.in]: countries } },
        // Also match country names in location field
        ...countries.map(c => ({ location: like(c) })),
      ];
    } else if (city) {
      whereTourism[Op.or] = [
        { location: like(city) },
        { country: like(city) },
      ];
    }
    
    // Funding: Apply flexible location matching and funding-specific filters
    const whereFunding = createFlexibleLocationFilter();
    
    // Apply funding-specific filters
    if (fundingGoal) {
      whereFunding.goal = { [Op.lte]: Number(fundingGoal) };
    }
    if (amountRaised) {
      whereFunding.raised = { [Op.gte]: Number(amountRaised) };
    }
    if (deadline) {
      // Filter for deadlines that are after the specified date
      whereFunding.deadline = { [Op.gte]: deadline };
    }

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

    // Apply audience filters to WHERE clauses for M2M associations
    if (effAudienceIdentityIdsStr.length > 0) {
      console.log("Applying audience identity filters:", effAudienceIdentityIdsStr);
      
      // Create a separate array for audience identity filters
      const audienceIdentityFilter = { "$audienceIdentities.id$": { [Op.in]: effAudienceIdentityIdsStr } };
      
      // For Job
      if (!whereJob[Op.and]) whereJob[Op.and] = [];
      whereJob[Op.and].push(audienceIdentityFilter);
      
      // For Event
      if (!whereEvent[Op.and]) whereEvent[Op.and] = [];
      whereEvent[Op.and].push(audienceIdentityFilter);
      
      // For Service
      if (!whereService[Op.and]) whereService[Op.and] = [];
      whereService[Op.and].push(audienceIdentityFilter);
      
      // For Product
      if (!whereProduct[Op.and]) whereProduct[Op.and] = [];
      whereProduct[Op.and].push(audienceIdentityFilter);
      
      // For Tourism
      if (!whereTourism[Op.and]) whereTourism[Op.and] = [];
      whereTourism[Op.and].push(audienceIdentityFilter);
      
      // For Funding
      if (!whereFunding[Op.and]) whereFunding[Op.and] = [];
      whereFunding[Op.and].push(audienceIdentityFilter);
    }

    if (effAudienceCategoryIdsStr.length > 0) {
      console.log("Applying audience category filters:", effAudienceCategoryIdsStr);
      
      // Create a separate array for audience category filters
      const audienceCategoryFilter = { "$audienceCategories.id$": { [Op.in]: effAudienceCategoryIdsStr } };
      
      // For Job
      if (!whereJob[Op.and]) whereJob[Op.and] = [];
      whereJob[Op.and].push(audienceCategoryFilter);
      
      // For Event
      if (!whereEvent[Op.and]) whereEvent[Op.and] = [];
      whereEvent[Op.and].push(audienceCategoryFilter);
      
      // For Service
      if (!whereService[Op.and]) whereService[Op.and] = [];
      whereService[Op.and].push(audienceCategoryFilter);
      
      // For Product
      if (!whereProduct[Op.and]) whereProduct[Op.and] = [];
      whereProduct[Op.and].push(audienceCategoryFilter);
      
      // For Tourism
      if (!whereTourism[Op.and]) whereTourism[Op.and] = [];
      whereTourism[Op.and].push(audienceCategoryFilter);
      
      // For Funding
      if (!whereFunding[Op.and]) whereFunding[Op.and] = [];
      whereFunding[Op.and].push(audienceCategoryFilter);
    }

    if (effAudienceSubcategoryIdsStr.length > 0) {
      console.log("Applying audience subcategory filters:", effAudienceSubcategoryIdsStr);
      
      // Create a separate array for audience subcategory filters
      const audienceSubcategoryFilter = { "$audienceSubcategories.id$": { [Op.in]: effAudienceSubcategoryIdsStr } };
      
      // For Job
      if (!whereJob[Op.and]) whereJob[Op.and] = [];
      whereJob[Op.and].push(audienceSubcategoryFilter);
      
      // For Event
      if (!whereEvent[Op.and]) whereEvent[Op.and] = [];
      whereEvent[Op.and].push(audienceSubcategoryFilter);
      
      // For Service
      if (!whereService[Op.and]) whereService[Op.and] = [];
      whereService[Op.and].push(audienceSubcategoryFilter);
      
      // For Product
      if (!whereProduct[Op.and]) whereProduct[Op.and] = [];
      whereProduct[Op.and].push(audienceSubcategoryFilter);
      
      // For Tourism
      if (!whereTourism[Op.and]) whereTourism[Op.and] = [];
      whereTourism[Op.and].push(audienceSubcategoryFilter);
      
      // For Funding
      if (!whereFunding[Op.and]) whereFunding[Op.and] = [];
      whereFunding[Op.and].push(audienceSubcategoryFilter);
    }

    if (effAudienceSubsubCategoryIdsStr.length > 0) {
      console.log("Applying audience subsubcategory filters:", effAudienceSubsubCategoryIdsStr);
      
      // Create a separate array for audience subsubcategory filters
      const audienceSubsubFilter = { "$audienceSubsubs.id$": { [Op.in]: effAudienceSubsubCategoryIdsStr } };
      
      // For Job
      if (!whereJob[Op.and]) whereJob[Op.and] = [];
      whereJob[Op.and].push(audienceSubsubFilter);
      
      // For Event
      if (!whereEvent[Op.and]) whereEvent[Op.and] = [];
      whereEvent[Op.and].push(audienceSubsubFilter);
      
      // For Service
      if (!whereService[Op.and]) whereService[Op.and] = [];
      whereService[Op.and].push(audienceSubsubFilter);
      
      // For Product
      if (!whereProduct[Op.and]) whereProduct[Op.and] = [];
      whereProduct[Op.and].push(audienceSubsubFilter);
      
      // For Tourism
      if (!whereTourism[Op.and]) whereTourism[Op.and] = [];
      whereTourism[Op.and].push(audienceSubsubFilter);
      
      // For Funding
      if (!whereFunding[Op.and]) whereFunding[Op.and] = [];
      whereFunding[Op.and].push(audienceSubsubFilter);
    }
    
    // Apply job-specific filters
    if (jobType) {
      // Handle multiple job types (comma-separated)
      const jobTypes = jobType.split(',').filter(Boolean);
      if (jobTypes.length > 0) {
        whereJob.jobType = { [Op.in]: jobTypes };
      }
    }
    if (workMode) {
      // Handle multiple work modes (comma-separated)
      const workModes = workMode.split(',').filter(Boolean);
      if (workModes.length > 0) {
        whereJob.workMode = { [Op.in]: workModes };
      }
    }
    if (experienceLevel) {
      // Handle multiple experience levels (comma-separated)
      const experienceLevels = experienceLevel.split(',').filter(Boolean);
      if (experienceLevels.length > 0) {
        whereJob.experienceLevel = { [Op.in]: experienceLevels };
        whereService.experienceLevel = { [Op.in]: experienceLevels };
      }
    }
    if (locationType) {
      // Handle multiple location types (comma-separated)
      const locationTypes = locationType.split(',').filter(Boolean);
      if (locationTypes.length > 0) {
        whereJob.locationType = { [Op.in]: locationTypes };
        whereService.locationType = { [Op.in]: locationTypes };
      }
    }
    
    // Apply service-specific filters
    if (serviceType) {
      // Handle multiple service types (comma-separated)
      const serviceTypes = serviceType.split(',').filter(Boolean);
      if (serviceTypes.length > 0) {
        whereService.serviceType = { [Op.in]: serviceTypes };
      }
    }
    if (priceType) {
      // Handle multiple price types (comma-separated)
      const priceTypes = priceType.split(',').filter(Boolean);
      if (priceTypes.length > 0) {
        whereService.priceType = { [Op.in]: priceTypes };
      }
    }
    if (deliveryTime) {
      // Handle multiple delivery times (comma-separated)
      const deliveryTimes = deliveryTime.split(',').filter(Boolean);
      if (deliveryTimes.length > 0) {
        whereService.deliveryTime = { [Op.in]: deliveryTimes };
      }
    }
    
    // Apply tourism-specific filters
    if (postType) {
      // Handle multiple post types (comma-separated)
      const postTypes = postType.split(',').filter(Boolean);
      if (postTypes.length > 0) {
        whereTourism.postType = { [Op.in]: postTypes };
      }
    }
    if (season) {
      // Handle multiple seasons (comma-separated)
      const seasons = season.split(',').filter(Boolean);
      if (seasons.length > 0) {
        whereTourism.season = { [Op.in]: seasons };
      }
    }
    if (budgetRange) {
      // Handle multiple budget ranges (comma-separated)
      const budgetRanges = budgetRange.split(',').filter(Boolean);
      if (budgetRanges.length > 0) {
        whereTourism.budgetRange = { [Op.in]: budgetRanges };
      }
    }
    
    // Apply event-specific filters
    if (eventType) {
      // Handle multiple event types (comma-separated)
      const eventTypes = eventType.split(',').filter(Boolean);
      if (eventTypes.length > 0) {
        whereEvent.eventType = { [Op.in]: eventTypes };
      }
    }
    if (date) {
      // Filter for events on or after the specified date
      whereEvent.date = { [Op.gte]: date };
    }
    if (registrationType) {
      // Handle multiple registration types (comma-separated)
      const registrationTypes = registrationType.split(',').filter(Boolean);
      if (registrationTypes.length > 0) {
        whereEvent.registrationType = { [Op.in]: registrationTypes };
      }
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
        { country: like(term) }, // Also match country names
      ]);
      
      whereEvent[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { city: like(term) },
        { country: like(term) }, // Also match country names
      ]);
      
      whereService[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { city: like(term) },
        { country: like(term) }, // Also match country names
      ]);
      
      whereProduct[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { country: like(term) }, // Also match country names
      ]);
      
      whereTourism[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { description: like(term) },
        { location: like(term) },
        { country: like(term) }, // Also match country names
      ]);
      
      whereFunding[Op.or] = searchTerms.flatMap(term => [
        { title: like(term) },
        { pitch: like(term) },
        { city: like(term) },
        { country: like(term) }, // Also match country names
      ]);
    }

    // Add filters for Funding audience (and direct category)
    // Use subQuery:false in queries where these $paths are used.
    if (categoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push(
        { categoryId }, // direct
        { "$audienceCategories.id$": categoryId } // M2M
      );
    }
    if (subcategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push(
        { "$audienceSubcategories.id$": subcategoryId }
      );
    }
    if (subsubCategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push(
        { "$audienceSubsubs.id$": subsubCategoryId }
      );
    }
    if (identityId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push(
        { "$audienceIdentities.id$": identityId }
      );
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
    const mapJob = (j) => {
      const jobData = {
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
        avatarUrl: j.postedBy?.avatarUrl || j.postedBy?.profile?.avatarUrl || null,
        // Add coverImage field if it exists
        coverImage: j.coverImage || j.coverImageBase64 || null,
        // Audience associations
        audienceCategories: (j.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (j.audienceSubcategories || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (j.audienceSubsubs || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (j.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        jobData.matchPercentage = calculateItemMatchPercentage(jobData);
      } else {
        jobData.matchPercentage = 20; // Default match percentage for non-logged in users
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
        
        // Debug all event fields to find image fields
        _debug_fields: process.env.NODE_ENV !== 'production' ? Object.keys(e.dataValues || e).filter(k =>
          typeof e[k] === 'string' &&
          (k.toLowerCase().includes('image') || k.toLowerCase().includes('cover') || k.toLowerCase().includes('photo'))
        ) : null,
        
        // Check for various possible image field names and handle the case where "Url" might be prepended
        coverImage: (() => {
          // Check all possible field names
          const possibleFields = [
            'coverImage', 'coverImageBase64', 'coverImageUrl', 'overImage',
            'overImageUrl', 'eventImage', 'eventCover', 'image', 'imageUrl'
          ];
          
          // Try each field
          for (const field of possibleFields) {
            if (e[field]) {
              let value = e[field];
              
              // Handle case where "Url" is prepended to the actual URL
              if (typeof value === 'string' && value.startsWith('Url')) {
                value = value.substring(3); // Remove "Url" prefix
              }
              
              console.log(`Found image in field ${field}: ${value}`);
              return value;
            }
          }
          
          // If we have any field with 'image' in its name, try that as a fallback
          const imageFields = Object.keys(e.dataValues || e).filter(k =>
            typeof e[k] === 'string' &&
            (k.toLowerCase().includes('image') || k.toLowerCase().includes('cover') || k.toLowerCase().includes('photo'))
          );
          
          if (imageFields.length > 0) {
            const field = imageFields[0];
            let value = e[field];
            
            // Handle case where "Url" is prepended to the actual URL
            if (typeof value === 'string' && value.startsWith('Url')) {
              value = value.substring(3); // Remove "Url" prefix
            }
            
            console.log(`Found image in fallback field ${field}: ${value}`);
            return value;
          }
          
          return null;
        })(),
        
        images: e.images ? (typeof e.images === 'string' ? JSON.parse(e.images || '[]') : (Array.isArray(e.images) ? e.images : [])) : [],
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
        // Audience associations
        audienceCategories: (e.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (e.audienceSubcategories || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (e.audienceSubsubs || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (e.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        eventData.matchPercentage = calculateItemMatchPercentage(eventData);
      } else {
        eventData.matchPercentage = 20; // Default match percentage for non-logged in users
      }
      
      return eventData;
    };

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
        images: s.attachments ? (typeof s.attachments === 'string' ? JSON.parse(s.attachments || '[]') : (Array.isArray(s.attachments) ? s.attachments : [])) : [],
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
        // Audience associations
        audienceCategories: (s.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (s.audienceSubcategories || []).map(sub => ({ id: String(sub.id), name: sub.name })),
        audienceSubsubs: (s.audienceSubsubs || []).map(sub => ({ id: String(sub.id), name: sub.name })),
        audienceIdentities: (s.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        serviceData.matchPercentage = calculateItemMatchPercentage(serviceData);
      } else {
        serviceData.matchPercentage = 20; // Default match percentage for non-logged in users
      }
      
      return serviceData;
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
      
      // Parse images safely - handle both array and JSON string formats
      let parsedImages = [];
      try {
        if (Array.isArray(p.images)) {
          parsedImages = p.images;
        } else if (typeof p.images === 'string') {
          parsedImages = JSON.parse(p.images || '[]');
        } else if (p.images && typeof p.images === 'object') {
          // Handle case where it might be a Sequelize object
          parsedImages = p.images;
        }
        console.log(`Product ${p.id} images parsed:`, parsedImages);
      } catch (err) {
        console.error(`Error parsing images for product ${p.id}:`, err.message);
      }
      
      // Parse tags safely
      let parsedTags = [];
      try {
        if (Array.isArray(p.tags)) {
          parsedTags = p.tags;
        } else if (typeof p.tags === 'string') {
          parsedTags = JSON.parse(p.tags || '[]');
        }
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
        // Audience associations
        audienceCategories: (p.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (p.audienceSubcategories || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (p.audienceSubsubs || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (p.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        productData.matchPercentage = calculateItemMatchPercentage(productData);
      } else {
        productData.matchPercentage = 20; // Default match percentage for non-logged in users
      }
      
      return productData;
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
      
      // Parse images safely - handle both array and JSON string formats
      let parsedImages = [];
      try {
        if (Array.isArray(t.images)) {
          parsedImages = t.images;
        } else if (typeof t.images === 'string') {
          parsedImages = JSON.parse(t.images || '[]');
        } else if (t.images && typeof t.images === 'object') {
          // Handle case where it might be a Sequelize object
          parsedImages = t.images;
        }
        console.log(`Tourism ${t.id} images parsed:`, parsedImages);
      } catch (err) {
        console.error(`Error parsing images for tourism ${t.id}:`, err.message);
      }
      
      // Parse tags safely
      let parsedTags = [];
      try {
        if (Array.isArray(t.tags)) {
          parsedTags = t.tags;
        } else if (typeof t.tags === 'string') {
          parsedTags = JSON.parse(t.tags || '[]');
        }
      } catch (err) {
        console.error(`Error parsing tags for tourism ${t.id}:`, err.message);
      }
      
      const tourismData = {
        kind: "tourism",
        id: t.id,
        postType: t.postType, // Destination | Experience | Culture
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
        // Audience associations
        audienceCategories: (t.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (t.audienceSubcategories || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (t.audienceSubsubs || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (t.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        tourismData.matchPercentage = calculateItemMatchPercentage(tourismData);
      } else {
        tourismData.matchPercentage = 20; // Default match percentage for non-logged in users
      }
      
      return tourismData;
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
      
      // Parse images safely - handle both array and JSON string formats
      let parsedImages = [];
      try {
        if (Array.isArray(f.images)) {
          parsedImages = f.images;
        } else if (typeof f.images === 'string') {
          parsedImages = JSON.parse(f.images || '[]');
        } else if (f.images && typeof f.images === 'object') {
          // Handle case where it might be a Sequelize object
          parsedImages = f.images;
        }
        console.log(`Funding ${f.id} images parsed:`, parsedImages);
      } catch (err) {
        console.error(`Error parsing images for funding ${f.id}:`, err.message);
      }
      
      // Parse tags safely
      let parsedTags = [];
      try {
        if (Array.isArray(f.tags)) {
          parsedTags = f.tags;
        } else if (typeof f.tags === 'string') {
          parsedTags = JSON.parse(f.tags || '[]');
        }
      } catch (err) {
        console.error(`Error parsing tags for funding ${f.id}:`, err.message);
      }
      
      // Parse links safely
      let parsedLinks = [];
      try {
        if (Array.isArray(f.links)) {
          parsedLinks = f.links;
        } else if (typeof f.links === 'string') {
          parsedLinks = JSON.parse(f.links || '[]');
        }
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
        deadline: f.deadline, // YYYY-MM-DD
        rewards: f.rewards || null,
        team: f.team || null,
        email: f.email || null,
        phone: f.phone || null,
        status: f.status,
        visibility: f.visibility,
        tags: parsedTags,
        links: parsedLinks,
        raised:f.raised,
        images: parsedImages,
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
        avatarUrl: f.creator?.avatarUrl || f.creator?.profile?.avatarUrl || null,
        // Audience associations
        audienceCategories: (f.audienceCategories || []).map(c => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (f.audienceSubcategories || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (f.audienceSubsubs || []).map(s => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (f.audienceIdentities || []).map(i => ({ id: String(i.id), name: i.name })),
      };
      
      // Calculate match percentage if user is logged in
      if (currentUserId) {
        fundingData.matchPercentage = calculateItemMatchPercentage(fundingData);
      } else {
        fundingData.matchPercentage = 20; // Default match percentage for non-logged in users
      }
      
      return fundingData;
    };

    // Calculate match percentage between current user and an item
    const calculateItemMatchPercentage = (item) => {
      // If no user is logged in, return default percentage
      if (!currentUserId) return 20;

      // Extract item's taxonomies
      const itemTaxonomies = {
        categories: (item.audienceCategories || []).map(c => String(c.id)),
        subcategories: (item.audienceSubcategories || []).map(s => String(s.id)),
        subsubcategories: (item.audienceSubsubs || []).map(s => String(s.id)),
        identities: (item.audienceIdentities || []).map(i => String(i.id)),
      };

      // Add direct category/subcategory if they exist
      if (item.categoryId) itemTaxonomies.categories.push(String(item.categoryId));
      if (item.subcategoryId) itemTaxonomies.subcategories.push(String(item.subcategoryId));

      // Remove duplicates
      itemTaxonomies.categories = [...new Set(itemTaxonomies.categories)];
      itemTaxonomies.subcategories = [...new Set(itemTaxonomies.subcategories)];
      itemTaxonomies.subsubcategories = [...new Set(itemTaxonomies.subsubcategories)];
      itemTaxonomies.identities = [...new Set(itemTaxonomies.identities)];

      // Define maximum possible score and required factors
      const MAX_SCORE = 100;

      // Always require at least these many factors for a 100% match
      const REQUIRED_FACTORS = 3;

      // Define weights for different match types (total should be 100)
      const WEIGHTS = {
        category: 25,       // Category interest match
        subcategory: 30,    // Subcategory interest match
        subsubcategory: 20, // Subsubcategory interest match
        identity: 15,       // Identity interest match
        location: 10,       // Location match
      };

      // Calculate score for each factor
      let totalScore = 0;
      let matchedFactors = 0;

      // Category matches (combine user interests with audience filter selections)
      const allUserCategoryIds = [...new Set([
        ...userDefaults.interestCategoryIds,
        ...effAudienceCategoryIds
      ])];

      if (allUserCategoryIds.length > 0 && itemTaxonomies.categories.length > 0) {
        const catMatches = itemTaxonomies.categories.filter(id =>
          allUserCategoryIds.includes(id));

        if (catMatches.length > 0) {
          // Calculate percentage of matching categories
          const catMatchPercentage = Math.min(1, catMatches.length /
            Math.max(allUserCategoryIds.length, itemTaxonomies.categories.length));

          totalScore += WEIGHTS.category * catMatchPercentage;
          matchedFactors++;
        }
      }

      // Subcategory matches (combine user interests with audience filter selections)
      const allUserSubcategoryIds = [...new Set([
        ...userDefaults.interestSubcategoryIds,
        ...effAudienceSubcategoryIds
      ])];

      if (allUserSubcategoryIds.length > 0 && itemTaxonomies.subcategories.length > 0) {
        const subMatches = itemTaxonomies.subcategories.filter(id =>
          allUserSubcategoryIds.includes(id));

        if (subMatches.length > 0) {
          // Calculate percentage of matching subcategories
          const subMatchPercentage = Math.min(1, subMatches.length /
            Math.max(allUserSubcategoryIds.length, itemTaxonomies.subcategories.length));

          totalScore += WEIGHTS.subcategory * subMatchPercentage;
          matchedFactors++;
        }
      }

      // Subsubcategory matches (combine user interests with audience filter selections)
      const allUserSubsubCategoryIds = [...new Set([
        ...userDefaults.interestSubsubCategoryIds,
        ...effAudienceSubsubCategoryIds
      ])];

      if (allUserSubsubCategoryIds.length > 0 && itemTaxonomies.subsubcategories.length > 0) {
        const xMatches = itemTaxonomies.subsubcategories.filter(id =>
          allUserSubsubCategoryIds.includes(id));

        if (xMatches.length > 0) {
          // Calculate percentage of matching subsubcategories
          const xMatchPercentage = Math.min(1, xMatches.length /
            Math.max(allUserSubsubCategoryIds.length, itemTaxonomies.subsubcategories.length));

          totalScore += WEIGHTS.subsubcategory * xMatchPercentage;
          matchedFactors++;
        }
      }

      // Identity matches (combine user interests with audience filter selections)
      const allUserIdentityIds = [...new Set([
        ...userDefaults.interestIdentityIds,
        ...effAudienceIdentityIds
      ])];

      if (allUserIdentityIds.length > 0 && itemTaxonomies.identities.length > 0) {
        const idMatches = itemTaxonomies.identities.filter(id =>
          allUserIdentityIds.includes(id));

        if (idMatches.length > 0) {
          // Calculate percentage of matching identities
          const idMatchPercentage = Math.min(1, idMatches.length /
            Math.max(allUserIdentityIds.length, itemTaxonomies.identities.length));

          totalScore += WEIGHTS.identity * idMatchPercentage;
          matchedFactors++;
        }
      }

      // Location match
      const itemCity = (item.city || item.location || "").toLowerCase();

      // Exact city match
      if (userDefaults.city && itemCity && itemCity === userDefaults.city.toLowerCase()) {
        totalScore += WEIGHTS.location * 0.6; // 60% of location score for exact city match
        matchedFactors++;
      }
      // Partial city name matching
      else if (userDefaults.city && itemCity &&
               (itemCity.includes(userDefaults.city.toLowerCase()) ||
                userDefaults.city.toLowerCase().includes(itemCity))) {
        totalScore += WEIGHTS.location * 0.3; // 30% of location score for partial city match
        matchedFactors++;
      }
      // Country match
      else if (userDefaults.country && item.country === userDefaults.country) {
        totalScore += WEIGHTS.location * 0.4; // 40% of location score for country match
        matchedFactors++;
      }

      // Apply a penalty if fewer than REQUIRED_FACTORS matched
      if (matchedFactors < REQUIRED_FACTORS) {
        // Apply a scaling factor based on how many factors matched
        const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }

      // Ensure the score is between 20 and 100
      // We use 20 as minimum to ensure all items have some match percentage
      return Math.max(20, Math.min(100, Math.round(totalScore)));
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
          subQuery: false, // Add this to prevent the subquery issue with audienceIdentities.id
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
          subQuery: false, // Add this to prevent the subquery issue with audience associations
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
          subQuery: false, // Add this to prevent the subquery issue with audience associations
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
          subQuery: false, // Add this to prevent the subquery issue with audience associations
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
          subQuery: false, // Add this to prevent the subquery issue with audience associations
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
          subQuery: false, // Always use false to prevent the subquery issue with audience associations
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
          subQuery: false, // Add this to prevent the subquery issue with audience associations
          where: whereJob,
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Event.findAll({
          subQuery: false, // Add this to prevent the subquery issue with audienceIdentities.id
          where: whereEvent,
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Service.findAll({
          subQuery: false, // Add this to prevent the subquery issue with audience associations
          where: whereService,
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Product.findAll({
          subQuery: false, // Add this to prevent the subquery issue with audience associations
          where: whereProduct,
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        Tourism.findAll({
          subQuery: false, // Add this to prevent the subquery issue with audience associations
          where: whereTourism,
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim * 2,
        }),
        // For Funding in "all" tab, we need to handle the audience associations differently
        // to avoid the "Unknown column 'audienceCategories.id' in 'where clause'" error
        Funding.findAll({
          // Don't use subQuery when we have taxonomy filters to avoid the error
          subQuery: false,
          where: categoryId
            ? { ...whereFunding, categoryId } // Use direct categoryId filter instead of the complex OR condition
            : whereFunding,
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
        subQuery: false, // Add this to prevent the subquery issue with audienceIdentities.id
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
        subQuery: false, // Add this to prevent the subquery issue with audience associations
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
        subQuery: false, // Add this to prevent the subquery issue with audience associations
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
        subQuery: false, // Add this to prevent the subquery issue with audience associations
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
        subQuery: false, // Add this to prevent the subquery issue with audience associations
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
        subQuery: false, // Always use false to prevent the subquery issue with audience associations
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
        subQuery: false, // Add this to prevent the subquery issue with audience associations
        where: whereJob,
        include: includeCategoryRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Event.findAll({
        subQuery: false, // Add this to prevent the subquery issue with audienceIdentities.id
        where: whereEvent,
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Service.findAll({
        subQuery: false, // Add this to prevent the subquery issue with audience associations
        where: whereService,
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Product.findAll({
        subQuery: false, // Add this to prevent the subquery issue with audience associations
        where: whereProduct,
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      Tourism.findAll({
        subQuery: false, // Add this to prevent the subquery issue with audience associations
        where: whereTourism,
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      }),
      // For Funding in "all" tab, we need to handle the audience associations differently
      // to avoid the "Unknown column 'audienceCategories.id' in 'where clause'" error
      Funding.findAll({
        // Always use subQuery: false to prevent the subquery issue with audience associations
        subQuery: false,
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

      // Define maximum possible score and required factors
      const MAX_SCORE = 100;
      
      // Always require at least these many factors for a 100% match
      const REQUIRED_FACTORS = 4;
      
      // Define weights for different match types (total should be 100)
      const WEIGHTS = {
        category: 20,       // Category match
        subcategory: 25,    // Subcategory match
        subsubcategory: 15, // Subsubcategory match
        identity: 10,       // Identity match
        country: 15,        // Country match
        city: 15,           // City match
      };
      
      // Calculate score for each factor
      let totalScore = 0;
      let matchedFactors = 0;
      
      // Category matches
      if (myWant.catSet.size > 0 && other.cats.length > 0) {
        const catMatches = other.cats.filter(id => myWant.catSet.has(id));
        if (catMatches.length > 0) {
          // Calculate percentage of matching categories
          const catMatchPercentage = Math.min(1, catMatches.length / Math.max(myWant.catSet.size, other.cats.length));
          totalScore += WEIGHTS.category * catMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Subcategory matches
      if (myWant.subSet.size > 0 && other.subs.length > 0) {
        const subMatches = other.subs.filter(id => myWant.subSet.has(id));
        if (subMatches.length > 0) {
          // Calculate percentage of matching subcategories
          const subMatchPercentage = Math.min(1, subMatches.length / Math.max(myWant.subSet.size, other.subs.length));
          totalScore += WEIGHTS.subcategory * subMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Subsubcategory matches
      if (myWant.xSet.size > 0 && other.xs.length > 0) {
        const xMatches = other.xs.filter(id => myWant.xSet.has(id));
        if (xMatches.length > 0) {
          // Calculate percentage of matching subsubcategories
          const xMatchPercentage = Math.min(1, xMatches.length / Math.max(myWant.xSet.size, other.xs.length));
          totalScore += WEIGHTS.subsubcategory * xMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Identity matches
      if (myWant.idSet.size > 0 && other.ids.length > 0) {
        const idMatches = other.ids.filter(id => myWant.idSet.has(id));
        if (idMatches.length > 0) {
          // Calculate percentage of matching identities
          const idMatchPercentage = Math.min(1, idMatches.length / Math.max(myWant.idSet.size, other.ids.length));
          totalScore += WEIGHTS.identity * idMatchPercentage;
          matchedFactors++;
        }
      }
      
      // City match
      const hisCity = (u.city || "").toLowerCase();
      if (myWant.city && hisCity && myWant.city === hisCity) {
        totalScore += WEIGHTS.city;
        matchedFactors++;
      }
      
      // Country match
      const hisCountry = u.countryOfResidence || u.country || null;
      if (myWant.country && hisCountry && myWant.country === hisCountry) {
        totalScore += WEIGHTS.country;
        matchedFactors++;
      }
      
      // Apply a penalty if fewer than REQUIRED_FACTORS matched
      // This ensures that a single category match won't result in a high percentage
      if (matchedFactors < REQUIRED_FACTORS) {
        // Apply a scaling factor based on how many factors matched
        const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }
      
      // Ensure the score is between 0 and 100
      return Math.max(0, Math.min(100, Math.round(totalScore)));
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
