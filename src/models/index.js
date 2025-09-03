const { DataTypes } = require("sequelize");
const { makeSequelize } = require("../config/db");

const sequelize = makeSequelize();

/* ============ Initialize models ============ */
const User = require("./user")(sequelize, DataTypes);
const Profile = require("./profile")(sequelize, DataTypes);
const VerificationToken = require("./verificationToken")(sequelize, DataTypes);

const Category = require("./category")(sequelize, DataTypes);
const Subcategory = require("./subcategory")(sequelize, DataTypes);

const Goal = require("./goal")(sequelize, DataTypes);
const UserGoal = require("./userGoal")(sequelize, DataTypes);

const UserCategory = require("./userCategory")(sequelize, DataTypes);
const UserSubcategory = require("./userSubcategory")(sequelize, DataTypes);

const NewsArticle = require("./newsArticle")(sequelize, DataTypes);

const Job = require("./job")(sequelize, DataTypes);
const Event = require("./event")(sequelize, DataTypes);

/* ============ Associations ============ */
// User ↔ Profile (1:1)
User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

// VerificationToken ↔ User (1:N)
VerificationToken.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(VerificationToken, { foreignKey: "userId", as: "verificationTokens" });

// Category ↔ Subcategory (1:N)
Category.hasMany(Subcategory, { foreignKey: "categoryId", as: "subcategories", onDelete: "CASCADE" });
Subcategory.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// User ↔ Goal (M:N via UserGoal)
User.belongsToMany(Goal, { through: UserGoal, foreignKey: "userId", as: "goals" });
Goal.belongsToMany(User, { through: UserGoal, foreignKey: "goalId", as: "users" });

// User ↔ Category (M:N via UserCategory)
User.belongsToMany(Category, { through: UserCategory, foreignKey: "userId", otherKey: "categoryId", as: "categories" });
Category.belongsToMany(User, { through: UserCategory, foreignKey: "categoryId", otherKey: "userId", as: "users" });

// User ↔ Subcategory (M:N via UserSubcategory)
User.belongsToMany(Subcategory, { through: UserSubcategory, foreignKey: "userId", otherKey: "subcategoryId", as: "subcategories" });
Subcategory.belongsToMany(User, { through: UserSubcategory, foreignKey: "subcategoryId", otherKey: "userId", as: "users" });

// User 1:N UserCategory (lista “interests” com cat/subcat resolvidos)
User.hasMany(UserCategory, { as: "interests", foreignKey: "userId" });
UserCategory.belongsTo(User, { as: "user", foreignKey: "userId" });
UserCategory.belongsTo(Category, { as: "category", foreignKey: "categoryId" });
UserCategory.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

// NewsArticle authoring
User.hasMany(NewsArticle,   { foreignKey: "userId", as: "news" });
NewsArticle.belongsTo(User, { foreignKey: "userId", as: "author" });

Profile.hasMany(NewsArticle,   { foreignKey: "profileId", as: "news" });
NewsArticle.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });

// Job posting
User.hasMany(Job, { foreignKey: "postedByUserId", as: "jobs" });
Job.belongsTo(User, { foreignKey: "postedByUserId", as: "postedBy" });

Job.belongsTo(Category,    { as: "category",    foreignKey: "categoryId" });
Job.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

// Event
User.hasMany(Event, { foreignKey: "organizerUserId", as: "events" });
Event.belongsTo(User, { foreignKey: "organizerUserId", as: "organizer" });

Event.belongsTo(Category,    { foreignKey: "categoryId",    as: "category" });
Event.belongsTo(Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });

/* ============ Exports ============ */
module.exports = {
  sequelize,
  User,
  Profile,
  VerificationToken,
  Category,
  Subcategory,
  UserCategory,
  UserSubcategory,
  NewsArticle,
  Goal,
  UserGoal,
  Event,
  Job,
};
