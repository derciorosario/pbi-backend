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
      limit = 20,
      offset = 0,
    } = req.query;

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
      whereProfile.experienceLevel = experienceLevel;
    }

    // ---- Include for interests (categories/subcategories) ----
    const interestsWhere = {};
    if (effCategoryIds.length) interestsWhere.categoryId = { [Op.in]: effCategoryIds };
    if (effSubcategoryIds.length) interestsWhere.subcategoryId = { [Op.in]: effSubcategoryIds };

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
         country || city || q || experienceLevel);

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
        },
      };
    });

    // ---- Order (score desc when no explicit filters, otherwise createdAt desc) ----
    let ordered;
    if (hasExplicitFilter) {
      ordered = scored.sort((a, b) => new Date(b.raw.createdAt) - new Date(a.raw.createdAt));
    } else {
      ordered = scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
      });
    }

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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to search people" });
  }
};
