const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define(
    "Job",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Basic
      title:          { type: DataTypes.STRING(180), allowNull: false },
      companyName:    { type: DataTypes.STRING(180), allowNull: false },
      department:     { type: DataTypes.STRING(120) },
      experienceLevel:{ type: DataTypes.ENUM("Junior","Mid-level","Senior","Lead"), allowNull: true },

      // Details
      jobType:        { type: DataTypes.ENUM("Full-time","Part-time","Contract","Internship","Temporary"), allowNull: false },
      workMode:       { type: DataTypes.ENUM("On-site","Remote","Hybrid"), allowNull: false },
      description:    { type: DataTypes.TEXT, allowNull: false },
      requiredSkills: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      // Location & Compensation
      country:        { type: DataTypes.STRING(80), allowNull: false },
      city:           { type: DataTypes.STRING(120) },
      minSalary:      { type: DataTypes.DECIMAL(12,2), allowNull: true },
      maxSalary:      { type: DataTypes.DECIMAL(12,2), allowNull: true },
      currency:       { type: DataTypes.STRING(10), allowNull: true }, // e.g. USD, NGN, ZAR...

      benefits:      { type: DataTypes.STRING(500) },

      // Application
      applicationDeadline:   { type: DataTypes.DATEONLY },
      positions:             { type: DataTypes.INTEGER, defaultValue: 1 },
      applicationInstructions:{ type: DataTypes.TEXT },
      contactEmail:          { type: DataTypes.STRING(160) },

      // Associations
      postedByUserId: { type: DataTypes.UUID, allowNull: false },
      categoryId:     { type: DataTypes.UUID, allowNull: false },      // industry
      subcategoryId:  { type: DataTypes.UUID, allowNull: true },       // optional

      status:         { type: DataTypes.ENUM("draft","published"), defaultValue: "published" },

      coverImageBase64: { type: DataTypes.TEXT('long'), allowNull: true },
    },
    {
      tableName: "jobs",
      timestamps: true,
      indexes: [{ fields: ["postedByUserId", "categoryId", "subcategoryId"] }],
    }
  );

  Job.associate = (models) => {
    Job.belongsTo(models.User, { foreignKey: "postedByUserId", as: "postedBy" });
    Job.belongsTo(Category, {
    as: "category",
    foreignKey: { name: "categoryId", allowNull: false },
    onDelete: "RESTRICT",   // ou "NO ACTION" / "CASCADE"
    onUpdate: "CASCADE",
    });

    // Subcategoria opcional ⇒ SET NULL é ok
    Job.belongsTo(Subcategory, {
    as: "subcategory",
    foreignKey: { name: "subcategoryId", allowNull: true },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
    });
  };

  return Job;
};
