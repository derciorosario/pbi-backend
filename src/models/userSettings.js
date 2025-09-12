// src/models/userSettings.js
module.exports = (sequelize, DataTypes) => {
  const UserSettings = sequelize.define('UserSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // <- must match User.tableName exactly
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    notifications: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        jobOpportunities: { email: true },
        connectionInvitations: { email: true },
        connectionRecommendations: { email: true },
        connectionUpdates: { email: true },
        messages: { email: true },
        meetingRequests: { email: true },
      },
    },
    emailFrequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'auto'),
      allowNull: false,
      defaultValue: 'daily',
    },
  }, {
    timestamps: true,
    // optional: freezeTableName: true,
  });

  return UserSettings;
};
