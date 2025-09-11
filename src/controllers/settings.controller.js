// src/controllers/settings.controller.js
const { User, UserSettings } = require("../models");

/**
 * Get user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSettings = async (req, res) => {
  try {
    
    const userId = req.user.id;

    // Find or create user settings
    let [settings, created] = await UserSettings.findOrCreate({
      where: { userId },
      defaults: {
        notifications: JSON.stringify({
          jobOpportunities: { email: true },
          connectionInvitations: { email: true },
          connectionRecommendations: { email: true },
          connectionUpdates: { email: true },
          messages: { email: true },
          meetingRequests: { email: true }
        }),
        emailFrequency: "daily"
      }
    });

    // Return the settings
    res.json(settings);
  } catch (error) {
    console.error("Error getting user settings:", error);
    res.status(500).json({ message: "Failed to get user settings" });
  }
};

/**
 * Update user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notifications, emailFrequency } = req.body;

    // Validate input
    if (!notifications || !emailFrequency) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate emailFrequency
    const validFrequencies = ["daily", "weekly", "monthly", "auto"];
    if (!validFrequencies.includes(emailFrequency)) {
      return res.status(400).json({ message: "Invalid email frequency" });
    }

    // Find or create user settings
    let [settings, created] = await UserSettings.findOrCreate({
      where: { userId },
      defaults: {
        notifications: JSON.stringify({
          jobOpportunities: { email: true },
          connectionInvitations: { email: true },
          connectionRecommendations: { email: true },
          connectionUpdates: { email: true },
          messages: { email: true },
          meetingRequests: { email: true }
        }),
        emailFrequency: "daily"
      }
    });

    // Update settings
    settings.notifications = typeof notifications === 'string' ? notifications : JSON.stringify(notifications);
    settings.emailFrequency = emailFrequency;
    await settings.save();

    // Return the updated settings
    res.json(settings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ message: "Failed to update user settings" });
  }
};