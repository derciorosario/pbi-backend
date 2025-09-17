// src/controllers/moderation.controller.js
const { Op } = require("sequelize");
const {
  Job,
  User,
  Profile,
  Report,
  Like,
  Comment,
  Repost
} = require("../models");

/**
 * Get content for moderation (with pagination and filtering)
 */
exports.getContentForModeration = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const {
      page = 1,
      limit = 10,
      contentType = "job",
      moderationStatus = "all",
      sortBy = "createdAt",
      sortOrder = "DESC"
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const whereClause = {};

    if (moderationStatus && moderationStatus !== "all") {
      whereClause.moderation_status = moderationStatus;
    }

    // Get content based on content type
    if (contentType === "job") {
      const { count, rows: jobs } = await Job.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "postedBy",
            attributes: ["id", "name", "avatarUrl"],
            include: [
              {
                model: Profile,
                as: "profile",
                attributes: ["professionalTitle"],
                required: false
              }
            ]
          }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get additional data for each job
      const jobsWithStats = await Promise.all(
        jobs.map(async (job) => {
          const [reportCount, likeCount, commentCount] = await Promise.all([
            Report.count({ where: { targetType: "job", targetId: job.id } }),
            Like.count({ where: { targetType: "job", targetId: job.id } }),
            Comment.count({ where: { targetType: "job", targetId: job.id } })
          ]);

          // Get the most recent reports
          const reports = await Report.findAll({
            where: { targetType: "job", targetId: job.id },
            include: [
              {
                model: User,
                as: "reporter",
                attributes: ["id", "name", "avatarUrl"]
              }
            ],
            order: [["createdAt", "DESC"]],
            limit: 5
          });

          return {
            id: job.id,
            title: job.title,
            companyName: job.companyName,
            description: job.description,
            jobType: job.jobType,
            workMode: job.workMode,
            country: job.country,
            city: job.city,
            status: job.status,
            moderation_status: job.moderation_status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            postedBy: {
              id: job.postedBy?.id,
              name: job.postedBy?.name,
              avatarUrl: job.postedBy?.avatarUrl,
              professionalTitle: job.postedBy?.profile?.professionalTitle
            },
            stats: {
              reports: reportCount,
              likes: likeCount,
              comments: commentCount
            },
            reports: reports.map(report => ({
              id: report.id,
              category: report.category,
              description: report.description,
              createdAt: report.createdAt,
              reporter: {
                id: report.reporter?.id,
                name: report.reporter?.name,
                avatarUrl: report.reporter?.avatarUrl
              }
            }))
          };
        })
      );

      res.json({
        content: jobsWithStats,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } else {
      // Handle other content types in the future
      return res.status(400).json({ message: "Unsupported content type" });
    }
  } catch (error) {
    console.error("Error getting content for moderation:", error);
    res.status(500).json({ message: "Failed to get content for moderation" });
  }
};

/**
 * Update content moderation status
 */
exports.updateModerationStatus = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;
    const { contentType = "job", moderationStatus } = req.body;

    if (!moderationStatus) {
      return res.status(400).json({ message: "Moderation status is required" });
    }

    // Update content based on content type
    if (contentType === "job") {
      const job = await Job.findByPk(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      job.moderation_status = moderationStatus;
      await job.save();

      res.json({
        message: `Job moderation status updated to ${moderationStatus}`,
        id: job.id,
        moderation_status: job.moderation_status
      });
    } else {
      // Handle other content types in the future
      return res.status(400).json({ message: "Unsupported content type" });
    }
  } catch (error) {
    console.error("Error updating moderation status:", error);
    res.status(500).json({ message: "Failed to update moderation status" });
  }
};

/**
 * Get moderation statistics
 */
exports.getModerationStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    // Get counts for different moderation statuses
    const [
      reportedCount,
      underReviewCount,
      approvedCount,
      removedCount,
      suspendedCount,
      totalReportsCount
    ] = await Promise.all([
      Job.count({ where: { moderation_status: "reported" } }),
      Job.count({ where: { moderation_status: "under_review" } }),
      Job.count({ where: { moderation_status: "approved" } }),
      Job.count({ where: { moderation_status: "removed" } }),
      Job.count({ where: { moderation_status: "suspended" } }),
      Report.count()
    ]);

    // Get counts for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      approvedToday,
      removedToday
    ] = await Promise.all([
      Job.count({
        where: {
          moderation_status: "approved",
          updatedAt: { [Op.gte]: today }
        }
      }),
      Job.count({
        where: {
          moderation_status: "removed",
          updatedAt: { [Op.gte]: today }
        }
      })
    ]);

    res.json({
      reported: reportedCount,
      underReview: underReviewCount,
      approved: approvedCount,
      removed: removedCount,
      suspended: suspendedCount,
      totalReports: totalReportsCount,
      today: {
        approved: approvedToday,
        removed: removedToday
      }
    });
  } catch (error) {
    console.error("Error getting moderation stats:", error);
    res.status(500).json({ message: "Failed to get moderation stats" });
  }
};

/**
 * Update report status when content is reported
 */
exports.handleContentReport = async (req, res, next) => {
  try {
    const { targetType, targetId } = req.body;

    // After creating the report, update the content's moderation status
    if (targetType === "job") {
      const job = await Job.findByPk(targetId);
      if (job && job.moderation_status === "approved") {
        job.moderation_status = "reported";
        await job.save();
      }
    }
    // Continue with the original report creation
    next();
  } catch (error) {
    console.error("Error handling content report:", error);
    next();
  }
};