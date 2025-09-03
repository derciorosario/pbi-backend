const { Job, Category, Subcategory } = require("../models");

const parseSkills = (s) => {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  return String(s).split(",").map(x => x.trim()).filter(Boolean);
};

const validateCategoryPair = async (categoryId, subcategoryId) => {
  const category = await Category.findByPk(categoryId);
  if (!category) throw new Error("Invalid categoryId");

  if (subcategoryId) {
    const sub = await Subcategory.findByPk(subcategoryId);
    if (!sub) throw new Error("Invalid subcategoryId");
    if (String(sub.categoryId) !== String(categoryId)) {
      throw new Error("subcategoryId does not belong to categoryId");
    }
  }
};

exports.createJob = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const {
      title, companyName, department, experienceLevel,
      jobType, workMode, description, requiredSkills,
      country, city, minSalary, maxSalary, currency, benefits,
      applicationDeadline, positions, applicationInstructions, contactEmail,
      categoryId, subcategoryId, status,
    } = req.body;

    await validateCategoryPair(categoryId, subcategoryId);

    // salary checks
    const minS = (minSalary !== undefined && minSalary !== null && minSalary !== "") ? Number(minSalary) : null;
    const maxS = (maxSalary !== undefined && maxSalary !== null && maxSalary !== "") ? Number(maxSalary) : null;
    if ((minS && Number.isNaN(minS)) || (maxS && Number.isNaN(maxS))) {
      return res.status(400).json({ message: "minSalary/maxSalary must be numbers" });
    }
    if (minS !== null && maxS !== null && minS > maxS) {
      return res.status(400).json({ message: "minSalary cannot be greater than maxSalary" });
    }

    const job = await Job.create({
      title, companyName, department, experienceLevel,
      jobType, workMode, description,
      requiredSkills: parseSkills(requiredSkills),
      country, city,
      minSalary: minS, maxSalary: maxS, currency, benefits,
      applicationDeadline: applicationDeadline || null,
      positions: positions ? Number(positions) : 1,
      applicationInstructions, contactEmail,
      categoryId, subcategoryId: subcategoryId || null,
      status: status || "published",
      postedByUserId: req.user.id,
    });

    res.status(201).json({ job });
  } catch (err) {
    console.error("createJob error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (String(job.postedByUserId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = { ...req.body };

    if (data.categoryId) {
      await validateCategoryPair(data.categoryId, data.subcategoryId || job.subcategoryId);
    }

    // normalize skills/salary
    if (data.requiredSkills !== undefined) data.requiredSkills = parseSkills(data.requiredSkills);
    if (data.minSalary !== undefined) data.minSalary = data.minSalary === "" ? null : Number(data.minSalary);
    if (data.maxSalary !== undefined) data.maxSalary = data.maxSalary === "" ? null : Number(data.maxSalary);
    if (data.minSalary !== null && data.maxSalary !== null && data.minSalary > data.maxSalary) {
      return res.status(400).json({ message: "minSalary cannot be greater than maxSalary" });
    }

    await job.update(data);
    res.json({ job });
  } catch (err) {
    console.error("updateJob error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getJob = async (req, res) => {
  const job = await Job.findByPk(req.params.id, {
    include: [
      { association: "category" },
      { association: "subcategory" },
      { association: "postedBy", attributes: ["id","name","email","role"] },
    ],
  });
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json({ job });
};

exports.listJobs = async (req, res) => {
  const { categoryId, subcategoryId, country, q } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (subcategoryId) where.subcategoryId = subcategoryId;
  if (country) where.country = country;
  if (q) where.title = { [require("sequelize").Op.like]: `%${q}%` };

  const jobs = await Job.findAll({
    where,
    order: [["createdAt","DESC"]],
    include: [{ association: "category" }, { association: "subcategory" }],
  });
  res.json({ jobs });
};
