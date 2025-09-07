// src/controllers/profile.controller.js
const { Op } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  UserCategory,
  Goal,
  UserGoal,
  Job,
  Event,
  Connection,
  ConnectionRequest,
} = require("../models");

const normalizePair = (id1, id2) => {
  const a = String(id1);
  const b = String(id2);
  return a < b ? [a, b] : [b, a];
};

const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  title: u.profile?.professionalTitle || null,
  city: u.city || null,
  country: u.country || null,
  avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
});

const basicUserInclude = [
  {
    model: Profile,
    as: "profile",
    attributes: ["professionalTitle", "avatarUrl"],
    required: false,
  },
];

exports.getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "accountType", "country", "city", "avatarUrl", "createdAt"],
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: [
            "professionalTitle",
            "about",
            "avatarUrl",
            "primaryIdentity",
            "experienceLevel",
            "skills",
            "languages",
          ],
        },
        {
          model: UserCategory,
          as: "interests",
          required: false,
          include: [
            { model: Category, as: "category", attributes: ["id", "name"] },
            { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
          ],
        },
        {
          model: Goal,
          as: "goals",
          attributes: ["id", "name"],
          through: { attributes: [] },
        },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.accountType === "admin") return res.status(404).json({ message: "User not found" });

    const [jobsCount, eventsCount, newsCount] = await Promise.all([
      Job.count({ where: { postedByUserId: user.id } }),
      Event.count({ where: { organizerUserId: user.id } }),
      Promise.resolve(0),
    ]);

    const [recentJobs, recentEvents] = await Promise.all([
      Job.findAll({
        where: { postedByUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "companyName", "city", "country", "createdAt"],
        include: [
          { model: Category, as: "category", attributes: ["name"] },
          { model: Subcategory, as: "subcategory", attributes: ["name"] },
        ],
      }),
      Event.findAll({
        where: { organizerUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "city", "country", "startAt", "createdAt", "registrationType", "price", "currency"],
        include: [
          { model: Category, as: "category", attributes: ["name"] },
          { model: Subcategory, as: "subcategory", attributes: ["name"] },
        ],
      }),
    ]);

    const expertise = [];
    const cats = [];
    const subs = [];

    (user.interests || []).forEach((it) => {
      if (it?.category?.name) {
        cats.push(it.category.name);
        if (!expertise.includes(it.category.name)) expertise.push(it.category.name);
      }
      if (it?.subcategory?.name) {
        subs.push(it.subcategory.name);
        if (!expertise.includes(it.subcategory.name)) expertise.push(it.subcategory.name);
      }
    });

    const goals = (user.goals || []).map((g) => ({ id: g.id, name: g.name }));
    const lookingFor = goals.map((g) => g.name);

    const mapJob = (j) => ({
      id: j.id,
      kind: "job",
      title: j.title,
      companyName: j.companyName,
      city: j.city,
      country: j.country,
      categoryName: j.category?.name || null,
      subcategoryName: j.subcategory?.name || null,
      createdAt: j.createdAt,
    });

    const mapEvent = (e) => ({
      id: e.id,
      kind: "event",
      title: e.title,
      city: e.city,
      country: e.country,
      categoryName: e.category?.name || null,
      subcategoryName: e.subcategory?.name || null,
      when: e.startAt,
      createdAt: e.createdAt,
      price: e.price,
      currency: e.currency,
      registrationType: e.registrationType,
    });

    let connectionStatus = "none";
    if (viewerId && String(viewerId) !== String(user.id)) {
      const [a, b] = normalizePair(viewerId, user.id);
      const [accepted, outgoingReq, incomingReq] = await Promise.all([
        Connection.findOne({ where: { userOneId: a, userTwoId: b } }),
        ConnectionRequest.findOne({
          where: { status: "pending", fromUserId: viewerId, toUserId: user.id },
        }),
        ConnectionRequest.findOne({
          where: { status: "pending", fromUserId: user.id, toUserId: viewerId },
        }),
      ]);
      if (accepted) connectionStatus = "connected";
      else if (outgoingReq) connectionStatus = "outgoing_pending";
      else if (incomingReq) connectionStatus = "incoming_pending";
    } else if (viewerId && String(viewerId) === String(user.id)) {
      connectionStatus = "self";
    }

    let connectionsBlock = undefined;
    let requestsBlock = undefined;

    if (viewerId && String(viewerId) === String(user.id)) {
      const conLimit = Number.isFinite(Number(req.query.conLimit)) ? Number(req.query.conLimit) : 24;
      const reqLimit = Number.isFinite(Number(req.query.reqLimit)) ? Number(req.query.reqLimit) : 24;

      const cons = await Connection.findAll({
        where: { [Op.or]: [{ userOneId: user.id }, { userTwoId: user.id }] },
        order: [["createdAt", "DESC"]],
        limit: conLimit,
      });

      const counterpartIds = cons.map((c) =>
        String(c.userOneId) === String(user.id) ? c.userTwoId : c.userOneId
      );
      const uniqueIds = [...new Set(counterpartIds)];

      const conUsers = uniqueIds.length
        ? await User.findAll({
            where: { id: uniqueIds, accountType: { [Op.ne]: "admin" } },
            attributes: ["id", "name", "city", "country", "avatarUrl"],
            include: basicUserInclude,
          })
        : [];

      connectionsBlock = {
        count: cons.length,
        items: conUsers.map(toPublicUser),
      };

      const [incomingRows, outgoingRows] = await Promise.all([
        ConnectionRequest.findAll({
          where: { status: "pending", toUserId: user.id },
          order: [["createdAt", "DESC"]],
          limit: reqLimit,
          include: [
            { model: User, as: "from", attributes: ["id", "name", "city", "country", "avatarUrl"], include: basicUserInclude },
          ],
        }),
        ConnectionRequest.findAll({
          where: { status: "pending", fromUserId: user.id },
          order: [["createdAt", "DESC"]],
          limit: reqLimit,
          include: [
            { model: User, as: "to", attributes: ["id", "name", "city", "country", "avatarUrl"], include: basicUserInclude },
          ],
        }),
      ]);

      requestsBlock = {
        incoming: incomingRows.map((r) => ({
          id: r.id,
          status: r.status,
          reason: r.reason || null,
          message: r.message || null,
          createdAt: r.createdAt,
          from: toPublicUser(r.from),
        })),
        outgoing: outgoingRows.map((r) => ({
          id: r.id,
          status: r.status,
          reason: r.reason || null,
          message: r.message || null,
          createdAt: r.createdAt,
          to: toPublicUser(r.to),
        })),
      };
    }

    const payload = {
      id: user.id,
      name: user.name,
      title: user.profile?.professionalTitle || null,
      city: user.city || null,
      country: user.country || null,
      avatarUrl: user.profile?.avatarUrl || user.avatarUrl || null,
      about: user.profile?.about || null,

      primaryIdentity: user.profile?.primaryIdentity || null,
      experienceLevel: user.profile?.experienceLevel || null,
      skills: Array.isArray(user.profile?.skills) ? user.profile.skills : [],
      languages: Array.isArray(user.profile?.languages) ? user.profile.languages : [],

      expertise,
      lookingFor,
      goals,
      cats,
      subs,

      projects: jobsCount + eventsCount + newsCount,
      memberSince: user.createdAt,
      email: user.email,

      recent: {
        jobs: recentJobs.map(mapJob),
        events: recentEvents.map(mapEvent),
      },

      connectionStatus,
      connections: connectionsBlock,
      requests: requestsBlock,
    };

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/**
 * Search for users by name or email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.sub;
    
    if (!q || q.length < 3) {
      return res.json([]);
    }
    
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ],
        id: { [Op.ne]: currentUserId }, // Exclude current user
        accountType: { [Op.ne]: "admin" } // Exclude admin users
      },
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle", "avatarUrl"],
          required: false
        }
      ],
      attributes: ["id", "name", "email", "avatarUrl", "city", "country"],
      limit: 10
    });
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.profile?.avatarUrl || user.avatarUrl,
      professionalTitle: user.profile?.professionalTitle || null,
      city: user.city || null,
      country: user.country || null
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
};
