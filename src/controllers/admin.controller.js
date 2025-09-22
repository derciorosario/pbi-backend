// src/controllers/admin.controller.js
const { Op } = require("sequelize");
const {
  User, Profile,
  Identity, Category, Subcategory, SubsubCategory,
  UserIdentity, UserCategory, UserSubcategory, UserSubsubCategory,
  UserIdentityInterest, UserCategoryInterest, UserSubcategoryInterest, UserSubsubCategoryInterest,
  Goal, UserGoal,
} = require("../models");
const { computeProfileProgress } = require("../utils/profileProgress");

/**
 * Get all users (with pagination and filtering)
 */
exports.getAllUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      accountType = "",
      isVerified = "",
      sortBy = "createdAt",
      sortOrder = "DESC"
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build where clause based on filters
     const whereClause = {
      accountType: { [Op.ne]: "admin" } // exclude admin accounts
    };
    
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (accountType && accountType !== "all") {
      whereClause.accountType = accountType;
    }
    
    if (isVerified !== "") {
      whereClause.isVerified = isVerified === "true";
    }

    // Get users with pagination
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle", "experienceLevel", "about"],
          required: false
        }
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      accountType: user.accountType,
      isVerified: user.isVerified,
      provider: user.provider,
      country: user.country,
      city: user.city,
      avatarUrl: user.avatarUrl || user.profile?.avatarUrl,
      professionalTitle: user.profile?.professionalTitle,
      experienceLevel: user.profile?.experienceLevel,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ message: "Failed to get users" });
  }
};

/**
 * Get a single user by ID
 */
exports.getUserById = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        {
          model: Profile,
          as: "profile",
          required: false
        },
        { model: Goal, as: "goals", attributes: ["id", "name"], through: { attributes: [] } },
        { model: Identity, as: "identities", attributes: ["id", "name"], through: { attributes: [] } },
        { model: Category, as: "categories", attributes: ["id", "name"], through: { attributes: [] } },
        { model: Subcategory, as: "subcategories", attributes: ["id", "name"], through: { attributes: [] } },
        { model: SubsubCategory, as: "subsubcategories", attributes: ["id", "name"], through: { attributes: [] } },
        { model: UserIdentityInterest, as: "identityInterests", include: [{ model: Identity, as: "identity" }] },
        { model: UserCategoryInterest, as: "categoryInterests", include: [{ model: Category, as: "category" }] },
        { model: UserSubcategoryInterest, as: "subcategoryInterests", include: [{ model: Subcategory, as: "subcategory" }] },
        { model: UserSubsubCategoryInterest, as: "subsubInterests", include: [{ model: SubsubCategory, as: "subsubCategory" }] },
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get counts for progress calculation
    const counts = {
      categories: user.categories?.length || 0,
      subcategories: user.subcategories?.length || 0,
      subsubs: user.subsubcategories?.length || 0,
      goals: user.goals?.length || 0
    };
    
    // Calculate progress using the same function as in profile controller
    const progress = computeProfileProgress({ user, profile: user.profile, counts });
    
    // Format response
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      accountType: user.accountType,
      isVerified: user.isVerified,
      provider: user.provider,
      country: user.country,
      countryOfResidence: user.countryOfResidence,
      city: user.city,
      nationality: user.nationality,
      avatarUrl: user.avatarUrl || user.profile?.avatarUrl,
      profile: user.profile,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      
      // Progress information
      progress,
      
      // Taxonomy
      identities: user.identities?.map(i => ({ id: i.id, name: i.name })) || [],
      categories: user.categories?.map(c => ({ id: c.id, name: c.name })) || [],
      subcategories: user.subcategories?.map(s => ({ id: s.id, name: s.name })) || [],
      subsubcategories: user.subsubcategories?.map(s3 => ({ id: s3.id, name: s3.name })) || [],

      // Interests
      interests: {
        identities: user.identityInterests?.map(ii => ({ id: ii.identity?.id, name: ii.identity?.name })) || [],
        categories: user.categoryInterests?.map(ci => ({ id: ci.category?.id, name: ci.category?.name })) || [],
        subcategories: user.subcategoryInterests?.map(si => ({ id: si.subcategory?.id, name: si.subcategory?.name })) || [],
        subsubcategories: user.subsubInterests?.map(si => ({ id: si.subsubCategory?.id, name: si.subsubCategory?.name })) || [],
      },

      // Goals
      goals: user.goals?.map(g => ({ id: g.id, name: g.name })) || [],
    };

    res.json(userData);
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
};

/**
 * Update a user
 */
exports.updateUser = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;
    const {
      name,
      email,
      phone,
      accountType,
      isVerified,
      country,
      countryOfResidence,
      city,
      nationality,
      profile
    } = req.body;

    // Find the user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (accountType !== undefined) user.accountType = accountType;
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (country !== undefined) user.country = country;
    if (countryOfResidence !== undefined) user.countryOfResidence = countryOfResidence;
    if (city !== undefined) user.city = city;
    if (nationality !== undefined) user.nationality = nationality;

    await user.save();

    // Update profile if provided
    if (profile) {
      let userProfile = await Profile.findOne({ where: { userId: id } });
      
      if (!userProfile) {
        // Create profile if it doesn't exist
        userProfile = await Profile.create({
          userId: id,
          ...profile
        });
      } else {
        // Update existing profile
        Object.keys(profile).forEach(key => {
          userProfile[key] = profile[key];
        });
        await userProfile.save();
      }
    }

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
};

/**
 * Delete a user
 */
exports.deleteUser = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;

    // Find the user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't allow deleting other admin users
    if (user.accountType === "admin" && user.id !== req.user.id) {
      return res.status(403).json({ message: "Cannot delete another admin user" });
    }

    // Delete the user
    await user.destroy();

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

/**
 * Suspend/unsuspend a user (by setting isVerified to false/true)
 */
exports.toggleUserSuspension = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;
    const { suspended } = req.body;

    // Find the user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't allow suspending other admin users
    if (user.accountType === "admin" && user.id !== req.user.id) {
      return res.status(403).json({ message: "Cannot suspend another admin user" });
    }

    // Update user's verification status (inverse of suspended)
    user.isVerified = suspended;
    await user.save();

    res.json({ 
      message: suspended ? "User suspended successfully" : "User unsuspended successfully",
      isVerified: user.isVerified
    });
  } catch (error) {
    console.error("Error toggling user suspension:", error);
    res.status(500).json({ message: "Failed to toggle user suspension" });
  }
};

/**
 * Export users data
 */
exports.exportUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== "admin") {
      return res.status(403).json({ message: "Unauthorized: Admin access required" });
    }

    const { format = "json", filters = {} } = req.query;
    
    // Build where clause based on filters
    const whereClause = {};
    
    if (filters.search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { email: { [Op.like]: `%${filters.search}%` } }
      ];
    }
    
    if (filters.accountType && filters.accountType !== "all") {
      whereClause.accountType = filters.accountType;
    }
    
    if (filters.isVerified !== undefined) {
      whereClause.isVerified = filters.isVerified === true;
    }

    // Get all users matching filters
    const users = await User.findAll({
      where: whereClause,
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle", "experienceLevel", "about"],
          required: false
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Format user data
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      accountType: user.accountType,
      isVerified: user.isVerified,
      provider: user.provider,
      country: user.country,
      city: user.city,
      professionalTitle: user.profile?.professionalTitle,
      experienceLevel: user.profile?.experienceLevel,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    // Return data in requested format
    if (format === "csv" || format === "excel") {
      // Convert to CSV
      const fields = Object.keys(formattedUsers[0] || {});
      let csv = fields.join(',') + '\n';
      
      formattedUsers.forEach(user => {
        const row = fields.map(field => {
          const value = user[field];
          // Handle values that might contain commas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value !== null && value !== undefined ? value : '';
        });
        csv += row.join(',') + '\n';
      });
      
      // Set appropriate headers based on format
      if (format === "excel") {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
      } else {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      }
      
      return res.send(csv);
    } else {
      // Default to JSON
      return res.json(formattedUsers);
    }
  } catch (error) {
    console.error("Error exporting users:", error);
    res.status(500).json({ message: "Failed to export users" });
  }
};