const { Event, Category, Subcategory } = require("../models");
const { Op } = require("sequelize");

// tiny helper
function ensurePaidFields(body) {
  if (body.registrationType === "Paid") {
    if (body.price == null || body.price === "")
      throw new Error("Price is required for paid events");
    if (!body.currency) throw new Error("Currency is required for paid events");
  }
}

function combineDateTime(dateStr, timeStr, tz) {
  // Expect date: "YYYY-MM-DD", time: "HH:mm" (24h). Store as UTC Date.
  // If you already send ISO from FE, you can skip this.
  const iso = `${dateStr}T${timeStr || "00:00"}:00${tz ? "" : "Z"}`;
  // We store raw ISO; DB will keep timestamp; FE can handle formatting by tz
  return new Date(iso);
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const currencies = [
    "USD","EUR","GBP","NGN","ZAR","GHS","KES","TZS","MAD","EGP","XOF","XAF","CFA","AOA","ETB","UGX","RWF","BWP","NAD","MZN"
  ];

  const timezones = [
    "Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Cairo","Africa/Casablanca",
    "Africa/Dakar","Africa/Dar_es_Salaam","Africa/Johannesburg","Africa/Kampala","Africa/Kigali",
    "Africa/Lagos","Africa/Nairobi","Africa/Maputo"
  ];

  res.json({ categories, currencies, timezones });
};

exports.create = async (req, res) => {
  try {
    const uid = req.user?.id; // from auth middleware
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      description,
      eventType,
      categoryId,
      subcategoryId,

      // date/time from FE:
      date,        // "YYYY-MM-DD"
      startTime,   // "HH:mm"
      endTime,     // "HH:mm"
      timezone,

      locationType,
      country,
      city,
      address,
      onlineUrl,

      registrationType,
      price,
      currency,
      capacity,
      registrationDeadline, // "YYYY-MM-DD"
      coverImageUrl,
      coverImageBase64
    } = req.body;

    if (!title || !description) return res.status(400).json({ message: "Title and description are required" });
    if (!eventType) return res.status(400).json({ message: "Event type is required" });
    if (!locationType) return res.status(400).json({ message: "Location type is required" });
    if (!date || !startTime) return res.status(400).json({ message: "Date and start time are required" });

    ensurePaidFields({ registrationType, price, currency });

    // Validate category/subcategory pair (optional)
    if (subcategoryId) {
      const sub = await Subcategory.findByPk(subcategoryId);
      if (!sub) return res.status(400).json({ message: "Invalid subcategory" });
      if (categoryId && sub.categoryId !== categoryId) {
        return res.status(400).json({ message: "Subcategory does not belong to selected category" });
      }
    }

    const startAt = combineDateTime(date, startTime, timezone);
    const endAt = endTime ? combineDateTime(date, endTime, timezone) : null;
    const regDeadline = registrationDeadline ? combineDateTime(registrationDeadline, "23:59", timezone) : null;

    const event = await Event.create({
      organizerUserId: uid,
      title,
      description,
      eventType,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      startAt,
      endAt,
      timezone: timezone || null,
      locationType,
      country: country || null,
      city: city || null,
      address: address || null,
      onlineUrl: onlineUrl || null,
      registrationType,
      price: registrationType === "Paid" ? price : null,
      currency: registrationType === "Paid" ? currency : null,
      capacity: capacity || null,
      registrationDeadline: regDeadline,
      coverImageUrl: coverImageUrl || null,
      coverImageBase64:coverImageBase64 || null
    });

    const created = await Event.findByPk(event.id, {
      include: [
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
      ],
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("createEvent error:", err);
    res.status(400).json({ message: err.message || "Could not create event" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.organizerUserId !== uid && req.user?.accountType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const body = req.body;
    if (body.registrationType) ensurePaidFields(body);

    // If FE still sends separate date/time updates:
    if (body.date || body.startTime || body.endTime) {
      const baseDate = body.date || event.startAt.toISOString().slice(0, 10);
      if (body.startTime) event.startAt = new Date(`${baseDate}T${body.startTime}:00Z`);
      if (body.endTime) event.endAt = new Date(`${baseDate}T${body.endTime}:00Z`);
    }

    // Simple update
    Object.assign(event, {
      title: body.title ?? event.title,
      description: body.description ?? event.description,
      eventType: body.eventType ?? event.eventType,
      categoryId: body.categoryId ?? event.categoryId,
      subcategoryId: body.subcategoryId ?? event.subcategoryId,
      timezone: body.timezone ?? event.timezone,
      locationType: body.locationType ?? event.locationType,
      country: body.country ?? event.country,
      city: body.city ?? event.city,
      address: body.address ?? event.address,
      onlineUrl: body.onlineUrl ?? event.onlineUrl,
      registrationType: body.registrationType ?? event.registrationType,
      price: (body.registrationType || event.registrationType) === "Paid" ? (body.price ?? event.price) : null,
      currency: (body.registrationType || event.registrationType) === "Paid" ? (body.currency ?? event.currency) : null,
      capacity: body.capacity ?? event.capacity,
      registrationDeadline: body.registrationDeadline ? new Date(`${body.registrationDeadline}T23:59:00Z`) : event.registrationDeadline,
      coverImageUrl: body.coverImageUrl ?? event.coverImageUrl,
    });

    await event.save();

    const updated = await Event.findByPk(event.id, {
      include: [
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
      ],
    });

    res.json(updated);
  } catch (err) {
    console.error("updateEvent error:", err);
    res.status(400).json({ message: err.message || "Could not update event" });
  }
};

exports.getOne = async (req, res) => {
  const { id } = req.params;
  const event = await Event.findByPk(id, {
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
    ],
  });
  if (!event) return res.status(404).json({ message: "Event not found" });
  res.json(event);
};

exports.list = async (req, res) => {
  const { q, categoryId, country } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (country) where.country = country;
  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }
  const rows = await Event.findAll({
    where,
    order: [["startAt", "ASC"]],
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
    ],
  });
  res.json(rows);
};
