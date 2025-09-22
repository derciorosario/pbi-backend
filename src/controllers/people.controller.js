// src/controllers/people.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
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

function like(v) { return { [Op.like]: `%${v}%` }; }
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [val];
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
      limit = 20,
      offset = 0,
    } = req.query;

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;
    const currentUserId = req.user?.id || null;

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
        connectionsOnly = false //userSettings?.connectionsOnly || false;

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
        }
      } catch (error) {
        console.error("Error loading user settings for connectionsOnly filter:", error);
      }
    }

    let myCategoryIds = [], mySubcategoryIds = [], myGoalIds = [];
    let myCountry = null, myCity = null;

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

    const catsList = ensureArray(cats);
    const effCategoryIds = ensureArray(categoryId).concat(catsList).filter(Boolean);
    const effSubcategoryIds = ensureArray(subcategoryId).filter(Boolean);
    const effGoalIds = ensureArray(goalId).filter(Boolean);

    const effIdentityIds = ensureArray(identityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);

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
        // IMPORTANT: include profile as required so title filter applies
        {
          model: Profile,
          as: "profile",
          required: true, // we require professionalTitle to be non-empty
          where: whereProfile,
          attributes: ["id", "userId", "professionalTitle", "about", "primaryIdentity", "avatarUrl", "experienceLevel"],
        },
        interestsInclude,
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
          : []),
        ...(effAudienceCategoryIds.length
          ? [{
              model: UserCategoryInterest,
              as: "categoryInterests",
              required: true,
              where: { categoryId: { [Op.in]: effAudienceCategoryIds } },
              include: [{ model: Category, as: "category" }],
            }]
          : []),
        ...(effAudienceSubcategoryIds.length
          ? [{
              model: UserSubcategoryInterest,
              as: "subcategoryInterests",
              required: true,
              where: { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } },
              include: [{ model: Subcategory, as: "subcategory" }],
            }]
          : []),
        ...(effAudienceSubsubCategoryIds.length
          ? [{
              model: UserSubsubCategoryInterest,
              as: "subsubCategoryInterests",
              required: true,
              where: { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } },
              include: [{ model: SubsubCategory, as: "subsubCategory" }],
            }]
          : []),
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

    const hasExplicitFilter = !!(
      effGoalIds.length ||
      effCategoryIds.length ||
      effSubcategoryIds.length ||
      effIdentityIds.length ||
      effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length ||
      effAudienceSubsubCategoryIds.length ||
      country || city || q || experienceLevel
    );

    // =============== Match % ===============
    const calculateMatchPercentage = (u) => {
      if (!currentUserId) return 20;
      const userGoalIds = (u.goals || []).map((g) => String(g.id));
      const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
      const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);

      const REQUIRED_FACTORS = 3;
      const WEIGHTS = { category: 30, subcategory: 35, goal: 25, location: 10 };
      let totalScore = 0, matchedFactors = 0;

      const allMyCategoryIds = [...new Set([...myCategoryIds, ...effAudienceCategoryIds])];
      if (allMyCategoryIds.length && userCats.length) {
        const catMatches = userCats.filter((id) => allMyCategoryIds.includes(id));
        if (catMatches.length) {
          const pct = Math.min(1, catMatches.length / Math.max(myCategoryIds.length, userCats.length));
          totalScore += WEIGHTS.category * pct; matchedFactors++;
        }
      }

      const allMySubcategoryIds = [...new Set([...mySubcategoryIds, ...effAudienceSubcategoryIds])];
      if (allMySubcategoryIds.length && userSubs.length) {
        const subMatches = userSubs.filter((id) => allMySubcategoryIds.includes(id));
        if (subMatches.length) {
          const pct = Math.min(1, subMatches.length / Math.max(mySubcategoryIds.length, userSubs.length));
          totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
        }
      }

      const myGoalSet = new Set(myGoalIds);
      const goalMatches = userGoalIds.filter((id) => myGoalSet.has(id)).length;
      if (goalMatches) { totalScore += WEIGHTS.goal * Math.min(1, goalMatches / Math.max(myGoalIds.length, userGoalIds.length)); matchedFactors++; }

      let locationScore = 0;
      if (myCountry && u.country && String(myCountry) === String(u.country)) locationScore += 0.6;
      if (myCity && u.city) {
        const a = String(myCity).toLowerCase(), b = String(u.city).toLowerCase();
        if (a === b) locationScore += 0.4; else if (a.includes(b) || b.includes(a)) locationScore += 0.2;
      }
      if (locationScore) { totalScore += WEIGHTS.location * locationScore; matchedFactors++; }

      if (matchedFactors < REQUIRED_FACTORS) totalScore *= Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
      return Math.max(20, Math.min(100, Math.round(totalScore)));
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
    return res.json({ count: items.length, items: windowed, sortedBy: "matchPercentage" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to search people" });
  }
};

