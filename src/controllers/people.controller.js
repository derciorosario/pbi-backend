// src/controllers/people.controller.js
const { Op } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
  UserGoal,
  Connection,
  ConnectionRequest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  Identity,
  SubsubCategory
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
      cats, // multiple category ids (comma-separated)
      subcategoryId,
      goalId,
      experienceLevel, // Added experienceLevel filter
      connectionStatus, // NEW: filter (comma-separated): connected,incoming_pending,outgoing_pending,none
      
      // Audience filters from AudienceTree
      identityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,
      limit = 20,
      offset = 0,
    } = req.query;

    console.log(identityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,)

    console.log("People search request:", {
      q,
      country,
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
      limit,
      offset
    });

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;

    const currentUserId = req.user?.id || null;

    // ---- Load viewer defaults to prioritize if NO explicit filters ----
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

    // ---- Effective interest filters from client ----
    const catsList = ensureArray(cats);
    const effCategoryIds = ensureArray(categoryId).concat(catsList).filter(Boolean);
    const effSubcategoryIds = ensureArray(subcategoryId).filter(Boolean);
    const effGoalIds = ensureArray(goalId).filter(Boolean);
    
    // Parse audience filter IDs
    const effIdentityIds = ensureArray(identityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);
    
    // Log audience filter parameters for debugging
    console.log("Audience filter parameters:", {
      identityIds: effIdentityIds,
      audienceCategoryIds: effAudienceCategoryIds,
      audienceSubcategoryIds: effAudienceSubcategoryIds,
      audienceSubsubCategoryIds: effAudienceSubsubCategoryIds
    });

    // ---- Base WHERE: hide admins and (if logged in) self ----
    const whereUser = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };
    // Enhanced flexible location matching
    if (country && city) {
      whereUser[Op.or] = [
        // Direct matches
        { country: country },
        { city: like(city) },
        
        // Cross matches (city value in country field or country value in city field)
        { country: like(city) },
        { city: like(country) },
      ];
    }
    // If only country is provided
    else if (country) {
      whereUser[Op.or] = [
        { country: country },
        { city: like(country) }, // Also match country name in city field
      ];
    }
    // If only city is provided
    else if (city) {
      whereUser[Op.or] = [
        { city: like(city) },
        { country: like(city) }, // Also match city name in country field
      ];
    }

    if (q) {
      whereUser[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { phone: like(q) },
        { biography: like(q) },
        { nationality: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
        { "$profile.primaryIdentity$": like(q) },
        { country: like(q) }, // Also match country names
        { city: like(q) }, // Also match city names
        { countryOfResidence: like(q) }, // Also match country of residence
      ];
    }

    // ---- Profile WHERE conditions ----
    const whereProfile = {};
    if (experienceLevel) {
      // Handle multiple experience levels (comma-separated)
      const experienceLevels = experienceLevel.split(',').filter(Boolean);
      if (experienceLevels.length > 0) {
        whereProfile.experienceLevel = { [Op.in]: experienceLevels };
      }
    }


    // ---- Include for interests (categories/subcategories) ----
    const interestsWhere = {};
    
    // Combine regular category filters with audience category filters
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

    // ---- Include for goals ----
    const goalsWhere = {};
    if (effGoalIds.length) goalsWhere.id = { [Op.in]: effGoalIds };

    const goalsInclude = {
      model: Goal,
      as: "goals",
      required: !!effGoalIds.length,
      where: Object.keys(goalsWhere).length ? goalsWhere : undefined,
      through: { attributes: [] },
    };

    // ---- Fetch more than limit to allow prioritization and post filtering ----
    const fetchLimit = lim * 3 + off;

    const rows = await User.findAll({
      where: whereUser,
      include: [
        {
          model: Profile,
          as: "profile",
          required: Object.keys(whereProfile).length > 0, // Make profile required if filtering by profile fields
          where: Object.keys(whereProfile).length > 0 ? whereProfile : undefined
        },
        interestsInclude,
        goalsInclude,
        
        // Add includes for audience interests if filters are provided
        ...(effIdentityIds.length > 0 ? [{
          model: UserIdentityInterest,
          as: "identityInterests",
          required: true,
          where: { identityId: { [Op.in]: effIdentityIds } },
          include: [{ model: Identity, as: "identity" }]
        }] : []),
        
        ...(effAudienceCategoryIds.length > 0 ? [{
          model: UserCategoryInterest,
          as: "categoryInterests",
          required: true,
          where: { categoryId: { [Op.in]: effAudienceCategoryIds } },
          include: [{ model: Category, as: "category" }]
        }] : []),
        
        ...(effAudienceSubcategoryIds.length > 0 ? [{
          model: UserSubcategoryInterest,
          as: "subcategoryInterests",
          required: true,
          where: { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } },
          include: [{ model: Subcategory, as: "subcategory" }]
        }] : []),
        
        ...(effAudienceSubsubCategoryIds.length > 0 ? [{
          model: UserSubsubCategoryInterest,
          as: "subsubCategoryInterests",
          required: true,
          where: { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } },
          include: [{ model: SubsubCategory, as: "subsubCategory" }]
        }] : []),
      ],
      order: [["createdAt", "DESC"]],
      limit: fetchLimit,
    });

    // ---- Compute connection sets (connected/pending) for the viewer ----
    const filterStatuses = ensureArray(connectionStatus).map((s) => s.toLowerCase());
    let connectedSet = new Set();
    let outgoingPendingSet = new Set();
    let incomingPendingSet = new Set();

    if (currentUserId) {
      // Accepted connections
      const cons = await Connection.findAll({
        where: { [Op.or]: [{ userOneId: currentUserId }, { userTwoId: currentUserId }] },
        attributes: ["userOneId", "userTwoId"],
      });
      cons.forEach((c) => {
        const other =
          String(c.userOneId) === String(currentUserId) ? String(c.userTwoId) : String(c.userOneId);
        connectedSet.add(other);
      });

      // Pending requests (outgoing / incoming)
      const [outgoingReqs, incomingReqs] = await Promise.all([
        ConnectionRequest.findAll({
          where: { fromUserId: currentUserId, status: "pending" },
          attributes: ["toUserId"],
        }),
        ConnectionRequest.findAll({
          where: { toUserId: currentUserId, status: "pending" },
          attributes: ["fromUserId"],
        }),
      ]);
      outgoingReqs.forEach((r) => outgoingPendingSet.add(String(r.toUserId)));
      incomingReqs.forEach((r) => incomingPendingSet.add(String(r.fromUserId)));
    }

    // ---- Scoring for prioritization when NO explicit filters ----
    const hasExplicitFilter =
      !!(effGoalIds.length || effCategoryIds.length || effSubcategoryIds.length ||
         effIdentityIds.length || effAudienceCategoryIds.length ||
         effAudienceSubcategoryIds.length || effAudienceSubsubCategoryIds.length ||
         country || city || q || experienceLevel);
    
    console.log(`Has explicit filters: ${hasExplicitFilter}, found ${rows.length} users matching criteria`);
    
    // Calculate match percentage between current user and another user
    const calculateMatchPercentage = (user) => {
      // If no user is logged in, return default percentage
      if (!currentUserId) return 20;
      
      // Extract user's taxonomies
      const userGoalIds = (user.goals || []).map((g) => String(g.id));
      const userCats = (user.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
      const userSubs = (user.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);
      
      // Define maximum possible score and required factors
      const MAX_SCORE = 100;
      
      // Always require at least these many factors for a 100% match
      const REQUIRED_FACTORS = 3;
      
      // Define weights for different match types (total should be 100)
      const WEIGHTS = {
        category: 30,       // Category match
        subcategory: 35,    // Subcategory match
        goal: 25,           // Goal match
        location: 10,       // Location match (country/city)
      };
      
      // Calculate score for each factor
      let totalScore = 0;
      let matchedFactors = 0;
      
      // Category matches
      // Add audience category IDs to the matching criteria
      const allMyCategoryIds = [...new Set([...myCategoryIds, ...effAudienceCategoryIds])];
      
      if (allMyCategoryIds.length > 0 && userCats.length > 0) {
        const catMatches = userCats.filter(id => allMyCategoryIds.includes(id));
        
        if (catMatches.length > 0) {
          // Calculate percentage of matching categories
          const catMatchPercentage = Math.min(1, catMatches.length /
            Math.max(myCategoryIds.length, userCats.length));
          
          totalScore += WEIGHTS.category * catMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Subcategory matches
      // Add audience subcategory IDs to the matching criteria
      const allMySubcategoryIds = [...new Set([...mySubcategoryIds, ...effAudienceSubcategoryIds])];
      
      if (allMySubcategoryIds.length > 0 && userSubs.length > 0) {
        const subMatches = userSubs.filter(id => allMySubcategoryIds.includes(id));
        
        if (subMatches.length > 0) {
          // Calculate percentage of matching subcategories
          const subMatchPercentage = Math.min(1, subMatches.length /
            Math.max(mySubcategoryIds.length, userSubs.length));
          
          totalScore += WEIGHTS.subcategory * subMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Goal matches
      if (myGoalIds.length > 0 && userGoalIds.length > 0) {
        const goalMatches = userGoalIds.filter(id => myGoalIds.includes(id));
        
        if (goalMatches.length > 0) {
          // Calculate percentage of matching goals
          const goalMatchPercentage = Math.min(1, goalMatches.length /
            Math.max(myGoalIds.length, userGoalIds.length));
          
          totalScore += WEIGHTS.goal * goalMatchPercentage;
          matchedFactors++;
        }
      }
      
      // Location match (country and city)
      let locationScore = 0;
      if (myCountry && user.country && String(myCountry) === String(user.country)) {
        locationScore += 0.6; // 60% of location score for country match
      }
      
      if (myCity && user.city) {
        const myLowerCity = String(myCity).toLowerCase();
        const userLowerCity = String(user.city).toLowerCase();
        
        if (userLowerCity === myLowerCity) {
          locationScore += 0.4; // 40% of location score for exact city match
        } else if (userLowerCity.includes(myLowerCity) || myLowerCity.includes(userLowerCity)) {
          locationScore += 0.2; // 20% of location score for partial city match
        }
      }
      
      if (locationScore > 0) {
        totalScore += WEIGHTS.location * locationScore;
        matchedFactors++;
      }
      
      // Apply a penalty if fewer than REQUIRED_FACTORS matched
      if (matchedFactors < REQUIRED_FACTORS) {
        // Apply a scaling factor based on how many factors matched
        const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
        totalScore = totalScore * scalingFactor;
      }
      
      // Ensure the score is between 20 and 100
      // We use 20 as minimum to ensure all users have some match percentage
      return Math.max(20, Math.min(100, Math.round(totalScore)));
    };

    const scored = rows.map((u) => {
      const userGoalIds = (u.goals || []).map((g) => String(g.id));
      const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
      const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);

      // Calculate match percentage
      const matchPercentage = calculateMatchPercentage(u);
      
      // Legacy scoring for sorting when no explicit filters
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

      // Connection status relative to viewer
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
        score,
        connectionStatus: cStatus,
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
          subcats: subsOut,
          about: u.profile?.about || null,
          createdAt: u.createdAt,
          connectionStatus: cStatus,
          matchPercentage: matchPercentage, // Add match percentage to output
        },
      };
    });

    // ---- Order by matchPercentage (highest first) ----
    let ordered = scored.sort((a, b) => {
      // First sort by matchPercentage (highest first)
      if (a.out.matchPercentage !== b.out.matchPercentage) {
        return b.out.matchPercentage - a.out.matchPercentage;
      }
      
      // If matchPercentage is the same, use legacy score for additional sorting
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      // If both matchPercentage and score are the same, sort by creation date
      return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
    });

    // ---- Optional filter by connectionStatus (works only meaningfully if logged in) ----
    let filtered = ordered;
    if (filterStatuses.length) {
      const allow = new Set(filterStatuses);
      filtered = ordered.filter((x) => allow.has(x.connectionStatus));
    }

    const windowed = filtered.slice(off, off + lim).map((x) => x.out);

    res.json({
      count: filtered.length,
      items: windowed,
      sortedBy: "matchPercentage" // Add information about sorting method
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to search people" });
  }
};
