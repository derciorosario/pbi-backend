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
const UserGoal = require("./userGoal")(sequelize, DataTypes)

const UserCategory = require("./userCategory")(sequelize, DataTypes);
const UserSubcategory = require("./userSubcategory")(sequelize, DataTypes);
// (If you also use Goal/UserGoal, init them here similarly)

/* ============ Associations ============ */
// User ↔ Profile
User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });


User.belongsToMany(Goal, { through: UserGoal, foreignKey: "userId", as: "goals" });
Goal.belongsToMany(User, { through: UserGoal, foreignKey: "goalId", as: "users" });


// VerificationToken ↔ User
VerificationToken.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(VerificationToken, { foreignKey: "userId", as: "verificationTokens" });

// Category ↔ Subcategory
Category.hasMany(Subcategory, { foreignKey: "categoryId", as: "subcategories", onDelete: "CASCADE" });
Subcategory.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

// User ↔ Category (many-to-many via UserCategory)
User.belongsToMany(Category, { through: UserCategory, foreignKey: "userId", otherKey: "categoryId", as: "categories" });
Category.belongsToMany(User, { through: UserCategory, foreignKey: "categoryId", otherKey: "userId", as: "users" });

// User ↔ Subcategory (many-to-many via UserSubcategory)
User.belongsToMany(Subcategory, { through: UserSubcategory, foreignKey: "userId", otherKey: "subcategoryId", as: "subcategories" });
Subcategory.belongsToMany(User, { through: UserSubcategory, foreignKey: "subcategoryId", otherKey: "userId", as: "users" });


const NewsArticle = require("./newsArticle")(sequelize, DataTypes);

// Author relations
User.hasMany(NewsArticle,   { foreignKey: "userId", as: "news" });
NewsArticle.belongsTo(User, { foreignKey: "userId", as: "author" });

Profile.hasMany(NewsArticle,   { foreignKey: "profileId", as: "news" });
NewsArticle.belongsTo(Profile, { foreignKey: "profileId", as: "profile" });


/* ============ Exports ============ */
module.exports = {
  sequelize,
  // Core
  User,
  Profile,
  VerificationToken,
  // Taxonomy
  Category,
  Subcategory,
  UserCategory,
  UserSubcategory,
  NewsArticle,
  Goal,
  UserGoal,
};
