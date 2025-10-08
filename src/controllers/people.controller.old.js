// src/controllers/people.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
  UserSubcategory,
  Connection,
  ConnectionRequest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  Identity,
  SubsubCategory,
  UserBlock,
  CompanyStaff,
} = require("../models");
const { cache } = require("../utils/redis");

function like(v) { return { [Op.like]: `%${v}%` }; }
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [val];
}

const PEOPLE_CACHE_TTL = 300;

function generatePeopleCacheKey(req) {
  const {
    q,
    country,
    accountType,
    city,
    categoryId,
    cats,
    subcategoryId,
    goalId,
    experienceLevel,
    connectionStatus,
    identityIds,
    audienceCategoryIds,
    audienceSubcategoryIds,
    audienceSubsubCategoryIds,
    viewOnlyConnections,
    industryIds,
    limit = 20,
    offset = 0,
  } = req.query;

  const currentUserId = req.user?.id || 'anonymous';

  const keyData = {
    q,
    country,
    accountType,
    city,
    categoryId,
    cats,
    subcategoryId,
    goalId,
    experienceLevel,
    connectionStatus,
    viewOnlyConnections,
    identityIds: ensureArray(identityIds),
    audienceCategoryIds: ensureArray(audienceCategoryIds),
    audienceSubcategoryIds: ensureArray(audienceSubcategoryIds),
    audienceSubsubCategoryIds: ensureArray(audienceSubsubCategoryIds),
    industryIds: ensureArray(industryIds),
    limit,
    offset,
    currentUserId,
  };

  Object.keys(keyData).forEach(k => {
    if (Array.isArray(keyData[k])) {
      keyData[k] = keyData[k].map(String).sort();
    }
  });

  return `people:${JSON.stringify(keyData)}`;
}

exports.searchPeople = async (req, res) => {
  try {
    const {
      q,
      country,
      accountType,
      city,
      categoryId,
      cats,
      subcategoryId,
      goalId,
      experienceLevel,
      connectionStatus,
      identityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,
      viewOnlyConnections,
      industryIds,
      limit = 20,
      offset = 0,
    } = req.query;

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;
    const currentUserId = req.user?.id || null;

    // People cache: try read first
    let __peopleCacheKey = generatePeopleCacheKey(req);
    try {
      const cached = await cache.get(__peopleCacheKey);
      if (cached) {
        console.log(`✅ People cache hit for key: ${__peopleCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("People cache read error:", e.message);
    }

    // Check if user has connectionsOnly enabled
    let connectionsOnly = false;
    let connectedUserIds = [];

    if (currentUserId) {
      try {
        const { UserSettings } = require("../models");
        const userSettings = await UserSettings.findOne({
          where: { userId: currentUserId },
          attributes: ['connectionsOnly']
        });
        connectionsOnly = userSettings?.connectionsOnly || viewOnlyConnections === 'true' || viewOnlyConnections === true;

        if (connectionsOnly) {
          // Get all connected user IDs (both directions)
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

          console.log(`Connections only filter enabled. Connected users: ${connectedUserIds.length}`);

           // If no connections, return empty result immediately
          if (connectedUserIds.length === 0) {
            const emptyResponse = { count: 0, items: [], sortedBy: "matchPercentage" };
            try {
              await cache.set(__peopleCacheKey, emptyResponse, PEOPLE_CACHE_TTL);
            } catch (e) {
              console.error("People cache write error:", e.message);
            }
            return res.json(emptyResponse);
          }


        }
      } catch (error) {
        console.error("Error loading user settings for connectionsOnly filter:", error);
      }
    }

    let myCategoryIds = [], mySubcategoryIds = [], mySubsubCategoryIds = [], myGoalIds = [];
    let myCountry = null, myCity = null;
    let myIdentities = [], myIdentityInterests = [], myCategoryInterests = [], mySubcategoryInterests = [], mySubsubCategoryInterests = [];

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city"],
        include: [
          { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          { model: Goal, as: "goals", attributes: ["id"] },
          { model: require("../models").Identity, as: "identities", attributes: ["id"], through: { attributes: [] } },
          { model: UserIdentityInterest, as: "identityInterests", attributes: ["identityId"], include: [{ model: require("../models").Identity, as: "identity", attributes: ["id"] }] },
          { model: UserCategoryInterest, as: "categoryInterests", attributes: ["categoryId"], include: [{ model: Category, as: "category", attributes: ["id"] }] },
          { model: UserSubcategoryInterest, as: "subcategoryInterests", attributes: ["subcategoryId"], include: [{ model: Subcategory, as: "subcategory", attributes: ["id"] }] },
          { model: UserSubsubCategoryInterest, as: "subsubInterests", attributes: ["subsubCategoryId"], include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }] },
          // Also load what the current user offers (subsubcategories)
          { model: require("../models").UserSubsubCategory, as: "userSubsubCategories", attributes: ["subsubCategoryId"], include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }] },
        ],
      });
      if (me) {
        myCountry = me.country || null;
        myCity = me.city || null;
        myCategoryIds = (me.interests || []).map((i) => String(i.categoryId)).filter(id => id && id !== 'null');
        mySubcategoryIds = (me.interests || []).map((i) => String(i.subcategoryId)).filter(id => id && id !== 'null');
        mySubsubCategoryIds = (me.userSubsubCategories || []).map((i) => String(i.subsubCategoryId)).filter(id => id && id !== 'null');
        myGoalIds = (me.goals || []).map((g) => String(g.id)).filter(Boolean);

        // Load current user's "does" and "looking for" data
        myIdentities = (me.identities || []).map(i => i);
        myIdentityInterests = (me.identityInterests || []).map(i => i);
        myCategoryInterests = (me.categoryInterests || []).map(i => i);
        mySubcategoryInterests = (me.subcategoryInterests || []).map(i => i);
        mySubsubCategoryInterests = (me.subsubInterests || []).map(i => i);

        // Debug logging
        console.log('Current user identity interests:', myIdentityInterests.map(i => i.identityId));
        console.log('Current user identities:', myIdentities.map(i => i.id));
        console.log('Current user category interests:', myCategoryInterests.map(i => i.categoryId));
        console.log('Current user subcategory interests:', mySubcategoryInterests.map(i => i.subcategoryId));
        console.log('Current user subsubcategory interests:', mySubsubCategoryInterests.map(i => i.subsubCategoryId));
        console.log('Raw subsubInterests from database:', me.subsubInterests);
      }

      // Fix: Handle subsubcategory interests properly
      // If user has explicit subsubcategory interests, use them directly
      if (mySubsubCategoryInterests.length > 0) {
        console.log(`User has explicit subsubcategory interests: ${mySubsubCategoryInterests.map(i => i.subsubCategoryId)}`);
      } else if (mySubcategoryInterests.length > 0) {
        console.log('User has subcategory interests but no explicit subsubcategory interests - inferring subsubcategories...');

        // Get the subcategories the user has interests in
        const interestedSubcategoryIds = mySubcategoryInterests.map(i => i.subcategoryId);

        // Get the subsubcategories the user is actually associated with (what they offer)
        const userSubsubCategoryIds = mySubsubCategoryIds;

        if (userSubsubCategoryIds.length > 0) {
          console.log(`User's actual subsubcategory associations: ${userSubsubCategoryIds.length} IDs`);

          // First, validate that these IDs actually exist in the database
          const validSubsubCategories = await SubsubCategory.findAll({
            where: {
              id: { [Op.in]: userSubsubCategoryIds }
            },
            attributes: ['id', 'subcategoryId']
          });

          console.log(`Found ${validSubsubCategories.length} valid subsubcategories in database`);

          if (validSubsubCategories.length > 0) {
            // Filter to only include subsubcategories that belong to the user's subcategory interests
            const validSubsubWithMatchingSubcategories = validSubsubCategories.filter(ss =>
              interestedSubcategoryIds.includes(ss.subcategoryId)
            );

            console.log(`Found ${validSubsubWithMatchingSubcategories.length} subsubcategories that match user's subcategory interests`);

            if (validSubsubWithMatchingSubcategories.length > 0) {
              // Create inferred subsubcategory interests from the validated intersection
              const inferredSubsubInterests = validSubsubWithMatchingSubcategories.map(ss => ({
                subsubCategoryId: ss.id,
                subsubCategory: ss
              }));

              mySubsubCategoryInterests = inferredSubsubInterests;
              console.log(`Inferred ${inferredSubsubInterests.length} subsubcategory interests from subcategory interests`);
              console.log(`Inferred subsubcategory IDs: ${inferredSubsubInterests.map(i => i.subsubCategoryId)}`);
            } else {
              console.log('No subsubcategories found that match both user interests and actual associations');
            }
          } else {
            console.log('No valid subsubcategories found in database for user associations');
          }
        } else {
          console.log('User has no subsubcategory associations to infer from');
        }
      } else {
        console.log('User has no subcategory or subsubcategory interests');
      }
    }

    const catsList = ensureArray(cats);
    const effCategoryIds = ensureArray(categoryId).concat(catsList).filter(Boolean);
    const effSubcategoryIds = ensureArray(subcategoryId).filter(Boolean);
    const effGoalIds = ensureArray(goalId).filter(Boolean);

    const effIdentityIds = ensureArray(identityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);
    const effIndustryIds = ensureArray(industryIds).filter(Boolean);

    // --- Blocklist exclusion (both directions) ---
    let excludeIds = [];
    if (currentUserId) {
      const [iBlock, theyBlock] = await Promise.all([
        UserBlock.findAll({ where: { blockerId: currentUserId }, attributes: ["blockedId"] }),
        UserBlock.findAll({ where: { blockedId: currentUserId }, attributes: ["blockerId"] }),
      ]);
      excludeIds = [
        ...new Set([
          ...iBlock.map((r) => String(r.blockedId)),
          ...theyBlock.map((r) => String(r.blockerId)),
        ]),
      ];
    }

    // =============== WHERE (User) =================
    const andClauses = [];
    const whereUser = {
      accountType: { [Op.ne]: "admin" },
      isVerified: true
    };
    if (currentUserId) whereUser.id = { [Op.notIn]: [String(currentUserId), ...excludeIds] };

    // Apply connectionsOnly filter if enabled
    if (connectionsOnly && connectedUserIds.length > 0) {
      whereUser.id = { [Op.in]: connectedUserIds };
    }

   

    if (accountType) {
      const types = ensureArray(accountType).map((t) => t.toLowerCase()).filter((t) => ["company", "individual"].includes(t));
      if (types.length) andClauses.push({ accountType: { [Op.in]: types } });
    }

    if (country && city) {
      andClauses.push({
        [Op.or]: [
          { country },
          { city: like(city) },
          { country: like(city) },
          { city: like(country) },
        ],
      });
    } else if (country) {
      andClauses.push({ [Op.or]: [{ country }, { city: like(country) }] });
    } else if (city) {
      andClauses.push({ [Op.or]: [{ city: like(city) }, { country: like(city) }] });
    }

    // --- q filter: user fields OR profile fields using $profile.field$ syntax ---
    if (q) {
      const qOr = [
        { name: like(q) },
        { email: like(q) },
        { phone: like(q) },
        { biography: like(q) },
        { nationality: like(q) },
        { country: like(q) },
        { city: like(q) },
        { countryOfResidence: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
        { "$profile.primaryIdentity$": like(q) },
      ];
      andClauses.push({ [Op.or]: qOr });
    }

    if (andClauses.length) whereUser[Op.and] = andClauses;

    // =============== WHERE (Profile) ===============
    // Always require a non-empty professionalTitle
    // Require profile.professionalTitle OR profile.about to be non-empty
      const whereProfile = {
        [Op.or]: [
          {
            [Op.and]: [
              { professionalTitle: { [Op.ne]: null } },
              Sequelize.where(
                Sequelize.fn("char_length", Sequelize.fn("trim", Sequelize.col("profile.professionalTitle"))),
                { [Op.gt]: 0 }
              ),
            ],
          },
          {
            [Op.and]: [
              { about: { [Op.ne]: null } },
              Sequelize.where(
                Sequelize.fn("char_length", Sequelize.fn("trim", Sequelize.col("profile.about"))),
                { [Op.gt]: 0 }
              ),
            ],
          },
        ],
      };


    if (experienceLevel) {
      const levels = experienceLevel.split(",").filter(Boolean);
      if (levels.length) {
        whereProfile.experienceLevel = { [Op.in]: levels };
      }
    }

    const hasExplicitFilter = !!(
      effGoalIds.length ||
      effCategoryIds.length ||
      effSubcategoryIds.length ||
      effIdentityIds.length ||
      effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length ||
      effAudienceSubsubCategoryIds.length ||
      effIndustryIds.length ||
      country || city || q || experienceLevel
    );

    // Profile should be required when filters that depend on profile data are used
    const profileRequired =  true

    // =============== Includes =====================
    // Interests include
    const interestsWhere = {};
    const allCategoryIds = [...new Set([...effCategoryIds, ...effAudienceCategoryIds])];
    const allSubcategoryIds = [...new Set([...effSubcategoryIds, ...effAudienceSubcategoryIds])];
    if (allCategoryIds.length) interestsWhere.categoryId = { [Op.in]: allCategoryIds };
    if (allSubcategoryIds.length) interestsWhere.subcategoryId = { [Op.in]: allSubcategoryIds };

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

    const subcategoriesInclude = {
      model: UserSubcategory,
      as: "userSubcategories",
      required: false,
      include: [
        { model: Subcategory, as: "subcategory", required: false },
      ],
    };

    const subsubcategoriesInclude = {
      model: require("../models").UserSubsubCategory,
      as: "userSubsubCategories",
      required: false,
      include: [
        { model: SubsubCategory, as: "subsubCategory", required: false },
      ],
    };

    // Goals include
    const goalsWhere = {};
    if (effGoalIds.length) goalsWhere.id = { [Op.in]: effGoalIds };
    const goalsInclude = {
      model: Goal,
      as: "goals",
      required: !!effGoalIds.length,
      where: Object.keys(goalsWhere).length ? goalsWhere : undefined,
      through: { attributes: [] },
    };

    const fetchLimit = lim * 3 + off;

    const rows = await User.findAll({
      where: whereUser,
      include: [
        // IMPORTANT: include profile as required when profile-dependent filters are used
        {
          model: Profile,
          as: "profile",
          required:  profileRequired,
          where: profileRequired ? whereProfile : undefined,
          attributes: ["id", "userId", "professionalTitle", "about", "primaryIdentity", "avatarUrl", "experienceLevel"],
        },
        interestsInclude,
        subcategoriesInclude,
        subsubcategoriesInclude,
        goalsInclude,
        // Include company staff relationships for approved staff members
        {
          model: CompanyStaff,
          as: "staffOf",
          where: { status: "confirmed" },
          required: false,
          include: [
            {
              model: User,
              as: "company",
              attributes: ["id", "name", "avatarUrl"],
              include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"], required: false }]
            }
          ]
        },
        ...(effIdentityIds.length
          ? [{
              model: UserIdentityInterest,
              as: "identityInterests",
              required: true,
              where: { identityId: { [Op.in]: effIdentityIds } },
              include: [{ model: Identity, as: "identity" }],
            }]
          : [{
              model: UserIdentityInterest,
              as: "identityInterests",
              required: false,
              include: [{ model: Identity, as: "identity" }],
            }]),
        ...(effAudienceCategoryIds.length
          ? [{
              model: UserCategoryInterest,
              as: "categoryInterests",
              required: true,
              where: { categoryId: { [Op.in]: effAudienceCategoryIds } },
              include: [{ model: Category, as: "category" }],
            }]
          : [{
              model: UserCategoryInterest,
              as: "categoryInterests",
              required: false,
              include: [{ model: Category, as: "category" }],
            }]),
        ...(effAudienceSubcategoryIds.length
          ? [{
              model: UserSubcategoryInterest,
              as: "subcategoryInterests",
              required: true,
              where: { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } },
              include: [{ model: Subcategory, as: "subcategory" }],
            }]
          : [{
              model: UserSubcategoryInterest,
              as: "subcategoryInterests",
              required: false,
              include: [{ model: Subcategory, as: "subcategory" }],
            }]),
        ...(effAudienceSubsubCategoryIds.length
          ? [{
              model: UserSubsubCategoryInterest,
              as: "subsubInterests",
              required: true,
              where: { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } },
              include: [{ model: SubsubCategory, as: "subsubCategory" }],
            }]
          : [{
              model: UserSubsubCategoryInterest,
              as: "subsubInterests",
              required: false,
              include: [{ model: SubsubCategory, as: "subsubCategory" }],
            }]),
        ...(effIndustryIds.length
          ? [{
              model: require("../models").UserIndustryCategory,
              as: "industryCategories",
              required: true,
              where: { industryCategoryId: { [Op.in]: effIndustryIds } },
              include: [{ model: require("../models").IndustryCategory, as: "industryCategory" }],
            }]
          : []),
        // Always include identities for match calculation
        {
          model: require("../models").Identity,
          as: "identities",
          required: false,
          through: { attributes: [] },
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: fetchLimit,
      subQuery: false,     // <-- required for $profile.*$ in WHERE
      distinct: true,
    });

    // =============== Connection status sets ===============
    const filterStatusesArr = ensureArray(connectionStatus).map((s) => s.toLowerCase());
    let connectedSet = new Set(), outgoingPendingSet = new Set(), incomingPendingSet = new Set();

    if (currentUserId) {
      const cons = await Connection.findAll({
        where: { [Op.or]: [{ userOneId: currentUserId }, { userTwoId: currentUserId }] },
        attributes: ["userOneId", "userTwoId"],
      });
      cons.forEach((c) => {
        const other = String(c.userOneId) === String(currentUserId) ? String(c.userTwoId) : String(c.userOneId);
        connectedSet.add(other);
      });

      const [outgoingReqs, incomingReqs] = await Promise.all([
        ConnectionRequest.findAll({ where: { fromUserId: currentUserId, status: "pending" }, attributes: ["toUserId"] }),
        ConnectionRequest.findAll({ where: { toUserId: currentUserId, status: "pending" }, attributes: ["fromUserId"] }),
      ]);
      outgoingPendingSet = new Set(outgoingReqs.map((r) => String(r.toUserId)));
      incomingPendingSet = new Set(incomingReqs.map((r) => String(r.fromUserId)));
    }


    // =============== Match % ===============
    const calculateMatchPercentage = (u) => {
      if (!currentUserId) {
        // When no current user, calculate based on applied filters (only taxonomy-based matching)
        const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
        let totalScore = 0, matchedFactors = 0;

        // Identity matching
        if (effIdentityIds.length) {
          const userIdentityIds = (u.identityInterests || []).map((i) => String(i.identityId)).filter(Boolean);
          const identityMatches = userIdentityIds.filter((id) => effIdentityIds.includes(id));
          if (identityMatches.length) {
            const pct = Math.min(1, identityMatches.length / effIdentityIds.length);
            totalScore += WEIGHTS.identity * pct; matchedFactors++;
          }
        }

        // Category matching
        if (effCategoryIds.length) {
          const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
          const catMatches = userCats.filter((id) => effCategoryIds.includes(id));
          if (catMatches.length) {
            const pct = Math.min(1, catMatches.length / effCategoryIds.length);
            totalScore += WEIGHTS.category * pct; matchedFactors++;
          }
        }

        // Subcategory matching
        if (effSubcategoryIds.length) {
          const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);
          const subMatches = userSubs.filter((id) => effSubcategoryIds.includes(id));
          if (subMatches.length) {
            const pct = Math.min(1, subMatches.length / effSubcategoryIds.length);
            totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
          }
        }

        // Subsubcategory matching
        if (effAudienceSubsubCategoryIds.length) {
          const userSubsubs = (u.subsubCategoryInterests || []).map((i) => String(i.subsubCategoryId)).filter(Boolean);
          const subsubMatches = userSubsubs.filter((id) => effAudienceSubsubCategoryIds.includes(id));
          if (subsubMatches.length) {
            const pct = Math.min(1, subsubMatches.length / effAudienceSubsubCategoryIds.length);
            totalScore += WEIGHTS.subsubcategory * pct; matchedFactors++;
          }
        }

        return Math.max(0, Math.min(100, Math.round(totalScore)));
      }

      // UNIDIRECTIONAL MATCHING ALGORITHM: Check if target user satisfies current user's interests
      // Get current user's "looking for" (interests) - what they want from others
      const currentUserIdentityInterests = new Set(myIdentityInterests.map(i => String(i.identityId)));
      const currentUserCategoryInterests = new Set(myCategoryInterests.map(i => String(i.categoryId)));
      const currentUserSubcategoryInterests = new Set(mySubcategoryInterests.map(i => String(i.subcategoryId)));
      const currentUserSubsubCategoryInterests = new Set(mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)));

      // Get target user's "does" (what they offer) - what they can provide
      const targetUserIdentities = new Set((u.identities || []).map(i => String(i.id)));
      const targetUserCategories = new Set((u.interests || []).map(i => String(i.categoryId)));
      const targetUserSubcategories = new Set((u.userSubcategories || []).map(i => String(i.subcategoryId)));
      const targetUserSubsubcategories = new Set((u.userSubsubCategories || []).map(i => String(i.subsubCategoryId)));

      // UNIDIRECTIONAL MATCHING LOGIC: Check if target satisfies current user's interests
      // Initialize the matches object
      const matches = {
        identity: 0,
        category: 0,
        subcategory: 0,
        subsubcategory: 0
      };

      // Debug logging
      console.log('=== UNIDIRECTIONAL MATCH ALGORITHM DEBUG ===');
      console.log('Current user interests (what they want):', {
        identity: [...currentUserIdentityInterests],
        category: [...currentUserCategoryInterests],
        subcategory: [...currentUserSubcategoryInterests],
        subsubcategory: [...currentUserSubsubCategoryInterests]
      });
      console.log('Target user does (what they offer):', {
        identity: [...targetUserIdentities],
        category: [...targetUserCategories],
        subcategory: [...targetUserSubcategories],
        subsubcategory: [...targetUserSubsubcategories]
      });

      // Direction 1: Current user wants -> Target user does (UNIDIRECTIONAL)
      // 1. Identity matching
      if (currentUserIdentityInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserIdentityInterests].filter(x => targetUserIdentities.has(x)));
        matches.identity = targetUserMatches.size / currentUserIdentityInterests.size;
        console.log(`Identity match: ${targetUserMatches.size}/${currentUserIdentityInterests.size} = ${Math.round(matches.identity * 100)}%`);
      }

      // 2. Category matching
      if (currentUserCategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserCategoryInterests].filter(x => targetUserCategories.has(x)));
        matches.category = targetUserMatches.size / currentUserCategoryInterests.size;
        console.log(`Category match: ${targetUserMatches.size}/${currentUserCategoryInterests.size} = ${Math.round(matches.category * 100)}%`);
      }

      // 3. Subcategory matching - exact matching only
      if (currentUserSubcategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserSubcategoryInterests].filter(x => targetUserSubcategories.has(x)));
        matches.subcategory = targetUserMatches.size / currentUserSubcategoryInterests.size;
        console.log(`Subcategory match: ${targetUserMatches.size}/${currentUserSubcategoryInterests.size} = ${Math.round(matches.subcategory * 100)}%`);
      }

      // 4. Subsubcategory matching
      if (currentUserSubsubCategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserSubsubCategoryInterests].filter(x => targetUserSubsubcategories.has(x)));
        matches.subsubcategory = targetUserMatches.size / currentUserSubsubCategoryInterests.size;
        console.log(`Subsubcategory match: ${targetUserMatches.size}/${currentUserSubsubCategoryInterests.size} = ${Math.round(matches.subsubcategory * 100)}%`);
      }

      // Calculate final percentage based ONLY on what the current user is looking for
      const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
      let totalScore = 0;
      let totalPossibleScore = 0;

      // Debug logging for final calculation
      console.log('=== FINAL CALCULATION DEBUG ===');
      console.log('Final matches:', matches);

      // Only include levels that the CURRENT USER (the one searching) has specified interests in
      // This ensures the percentage reflects only what the current user is looking for
      Object.keys(matches).forEach(level => {
        const currentUserHasInterest = (
          (level === 'identity' && currentUserIdentityInterests.size > 0) ||
          (level === 'category' && currentUserCategoryInterests.size > 0) ||
          (level === 'subcategory' && currentUserSubcategoryInterests.size > 0) ||
          (level === 'subsubcategory' && currentUserSubsubCategoryInterests.size > 0)
        );

        // Only include this level if the CURRENT USER is looking for it
        // This ensures we only evaluate what the searching user wants
        if (currentUserHasInterest) {
          totalScore += WEIGHTS[level] * matches[level];
          totalPossibleScore += WEIGHTS[level];
          console.log(`${level}: ${Math.round(WEIGHTS[level] * matches[level])}/${WEIGHTS[level]} (${Math.round(matches[level] * 100)}%)`);
        }
      });

      console.log(`Total score: ${Math.round(totalScore)}/${totalPossibleScore}`);

      // Return percentage based on mutual satisfaction
      if (totalPossibleScore === 0) return 0;
      const finalPercentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
      console.log(`Final percentage: ${finalPercentage}%`);
      return finalPercentage;
    };

      let items = rows.map((u) => {
      const matchPercentage = calculateMatchPercentage(u);
      let cStatus = "none";
      if (currentUserId) {
        const uid = String(u.id);
        if (connectedSet.has(uid)) cStatus = "connected";
        else if (outgoingPendingSet.has(uid)) cStatus = "outgoing_pending";
        else if (incomingPendingSet.has(uid)) cStatus = "incoming_pending";
      }

      const goalNames = (u.goals || []).map((g) => g.name).filter(Boolean);
      const catsOut = (u.interests || []).map((i) => i.category?.name).filter(Boolean);
      const subsOut = (u.interests || []).map((i) => i.subcategory?.name).filter(Boolean);

      return {
        raw: u,
        score: 0,
        out: {
          id: u.id,
          name: u.name,
          role: u.profile?.professionalTitle || null,
          city: u.city || null,
          country: u.country || null,
          countryOfResidence: u.countryOfResidence,
          avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
          email: u.email,
          lookingFor: goalNames.join(", "),
          goals: goalNames,
          cats: catsOut,
          subcats: subsOut,
          about: u.profile?.about || null,
          createdAt: u.createdAt,
          connectionStatus: cStatus,
          accountType: u.accountType,
          matchPercentage,

          // Company information for approved staff members
          companyMemberships: u.staffOf?.map(staff => ({
            id: staff.id,
            companyId: staff.companyId,
            role: staff.role,
            isMain: staff.isMain,
            joinedAt: staff.confirmedAt,
            company: {
              id: staff.company.id,
              name: staff.company.name,
              avatarUrl: staff.company.profile?.avatarUrl || staff.company.avatarUrl,
            }
          })) || [],
        },
      };
    });

    // Sort by matchPercentage then recency
    items.sort((a, b) => {
      if (a.out.matchPercentage !== b.out.matchPercentage) return b.out.matchPercentage - a.out.matchPercentage;
      return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
    });

    // Optional connection status filter
    if (ensureArray(connectionStatus).length) {
      const allow = new Set(ensureArray(connectionStatus).map((s) => s.toLowerCase()));
      items = items.filter((x) => allow.has(x.out.connectionStatus));
    }

    const windowed = items.slice(off, off + lim).map((x) => x.out);
    const response = { count: items.length, items: windowed, sortedBy: "matchPercentage" };
    try {
      await cache.set(__peopleCacheKey, response, PEOPLE_CACHE_TTL);
      console.log(`💾 People cached: ${__peopleCacheKey}`);
    } catch (e) {
      console.error("People cache write error:", e.message);
    }
    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to search people" });
  }
};