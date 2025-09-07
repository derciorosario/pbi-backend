const { Op } = require("sequelize");
const {
  User,
  Connection,
  ConnectionRequest,
  Notification,
} = require("../models");

// normaliza par (userOneId < userTwoId) para conexão única
function normalizePair(a, b) {
  return String(a) < String(b)
    ? { userOneId: a, userTwoId: b }
    : { userOneId: b, userTwoId: a };
}

exports.createRequest = async (req, res) => {
  try {
    const fromUserId = req.user?.id;
    const { toUserId, reason, message } = req.body;

    if (!fromUserId) return res.status(401).json({ message: "Unauthorized" });
    if (!toUserId)   return res.status(400).json({ message: "toUserId is required" });
    if (fromUserId === toUserId) return res.status(400).json({ message: "Cannot connect to yourself" });

    // já conectados?
    const pair = normalizePair(fromUserId, toUserId);
    const existingConn = await Connection.findOne({ where: pair });
    if (existingConn) return res.status(409).json({ message: "You are already connected" });

    // pendente em qualquer direção?
    const pending = await ConnectionRequest.findOne({
      where: {
        status: "pending",
        [Op.or]: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      },
    });
    if (pending) return res.status(409).json({ message: "A pending request already exists" });

    // cria request
    const reqRow = await ConnectionRequest.create({ fromUserId, toUserId, reason, message });

    // notifica destinatário
    const fromUser = await User.findByPk(fromUserId, { attributes: ["id", "name", "email"] });
    await Notification.create({
      userId: toUserId,
      type: "connection.request",
      payload: { requestId: reqRow.id, fromUserId, fromName: fromUser?.name || "Someone" },
    });

    return res.json({ ok: true, requestId: reqRow.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create request" });
  }
};

exports.getMyPending = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const incoming = await ConnectionRequest.findAll({
      where: { toUserId: userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "from", attributes: ["id", "name", "email", "avatarUrl"] }],
    });

    const outgoing = await ConnectionRequest.findAll({
      where: { fromUserId: userId, status: "pending" },
      order: [["createdAt", "DESC"]],
      include: [{ model: User, as: "to", attributes: ["id", "name", "email", "avatarUrl"] }],
    });

    res.json({
      incoming: incoming.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromName: r.from?.name,
        reason: r.reason,
        message: r.message,
        createdAt: r.createdAt,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        toUserId: r.toUserId,
        toName: r.to?.name,
        reason: r.reason,
        message: r.message,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load pending requests" });
  }
};

exports.respond = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { action } = req.body; // "accept" | "reject"

    

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const row = await ConnectionRequest.findByPk(id);
    if (!row || row.toUserId !== userId) return res.status(404).json({ message: "Request not found" });
    if (row.status !== "pending") return res.status(400).json({ message: "Already handled" });

    if (action === "accept") {
      const pair = normalizePair(row.fromUserId, row.toUserId);
      const exists = await Connection.findOne({ where: pair });
      if (!exists) await Connection.create(pair);

      row.status = "accepted";
      row.respondedAt = new Date();
      await row.save();

      await Notification.create({
        userId: row.fromUserId,
        type: "connection.accepted",
        payload: { byUserId: userId, requestId: row.id },
      });

      return res.json({ ok: true, status: "accepted" });
    }

    if (action === "reject") {
      row.status = "rejected";
      row.respondedAt = new Date();
      await row.save();

      await Notification.create({
        userId: row.fromUserId,
        type: "connection.rejected",
        payload: { byUserId: userId, requestId: row.id },
      });

      return res.json({ ok: true, status: "rejected" });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to respond" });
  }
};

exports.getMyConnections = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cons = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      order: [["createdAt", "DESC"]],
    });

    const otherIds = cons.map((c) => (c.userOneId === userId ? c.userTwoId : c.userOneId));
    const users = await User.findAll({ where: { id: { [Op.in]: otherIds } }, attributes: ["id", "name", "email", "avatarUrl", "country", "city"] });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load connections" });
  }
};
