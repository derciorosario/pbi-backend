const { JobApplication, Job, User } = require("../models");
const { cache } = require("../utils/redis");

exports.createApplication = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { jobId, coverLetter, expectedSalary, availability, availabilityDate, employmentType, cvData } = req.body;

    if (!jobId || !coverLetter) {
      return res.status(400).json({ message: "jobId and coverLetter are required" });
    }

    // Check if job exists
    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Check if user already applied
    const existing = await JobApplication.findOne({
      where: { userId: req.user.id, jobId }
    });
    if (existing) {
      return res.status(400).json({ message: "You have already applied for this job" });
    }

    const application = await JobApplication.create({
      userId: req.user.id,
      jobId,
      coverLetter,
      expectedSalary: expectedSalary || null,
      availability: availability || null,
      availabilityDate: availability === 'specific' ? availabilityDate : null,
      employmentType: employmentType || null,
      cvBase64: cvData || null,
    });

    await cache.deleteKeys([
            ["feed", "jobs", req.user.id] 
    ]);
    await cache.deleteKeys([
           ["feed","all",req.user.id] 
    ]);

    res.status(201).json({ application });
  } catch (err) {
    console.error("createApplication error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getApplicationsForJob = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { jobId } = req.params;

    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // Only job poster can view applications
    if (String(job.postedByUserId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const applications = await JobApplication.findAll({
      where: { jobId },
      include: [
        { association: "applicant", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ applications });
  } catch (err) {
    console.error("getApplicationsForJob error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const applications = await JobApplication.findAll({
      where: { userId: req.user.id },
      include: [
        {
          association: "job",
          attributes: ["id", "title", "companyName"],
          include: [{ association: "postedBy", attributes: ["id", "name"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ applications });
  } catch (err) {
    console.error("getMyApplications error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body;

    const application = await JobApplication.findByPk(id, {
      include: [{ association: "job" }]
    });
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Only job poster can update status
    if (String(application.job.postedByUserId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await application.update({ status });

    res.json({ application });
  } catch (err) {
    console.error("updateApplicationStatus error", err);
    res.status(400).json({ message: err.message });
  }
};