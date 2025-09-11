// src/models/userSettings.js
module.exports = (sequelize, DataTypes) => {
  const UserSettings = sequelize.define('UserSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    notifications: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: JSON.stringify({
        jobOpportunities: {
          email: true
        },
        connectionInvitations: {
          email: true
        },
        connectionRecommendations: {
          email: true
        },
        connectionUpdates: {
          email: true
        },
        messages: {
          email: true
        },
        meetingRequests: {
          email: true
        }
      })
    },
    emailFrequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'auto'),
      allowNull: false,
      defaultValue: 'daily'
    }
  }, {
    timestamps: true
  });

  return UserSettings;
};