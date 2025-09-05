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


const Connection        = require("./connection")(sequelize, DataTypes);
const ConnectionRequest = require("./connectionRequest")(sequelize, DataTypes);
const Notification      = require("./notification")(sequelize, DataTypes);


User.hasMany(ConnectionRequest, { foreignKey: "fromUserId", as: "sentRequests" });
User.hasMany(ConnectionRequest, { foreignKey: "toUserId",   as: "receivedRequests" });

User.hasMany(Connection, { foreignKey: "userOneId", as: "connectionsAsOne" });
User.hasMany(Connection, { foreignKey: "userTwoId", as: "connectionsAsTwo" });

Notification.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Notification,   { foreignKey: "userId", as: "notifications" });


// For requests preview includes
ConnectionRequest.belongsTo(User, { as: "from", foreignKey: "fromUserId" });
ConnectionRequest.belongsTo(User, { as: "to", foreignKey: "toUserId" });
User.hasMany(ConnectionRequest, { as: "incomingRequests", foreignKey: "toUserId" });
User.hasMany(ConnectionRequest, { as: "outgoingRequests", foreignKey: "fromUserId" });

// For connections
// (no strict includes needed; we query by ids)
const Identity           = require("./identity")(sequelize, DataTypes);
const UserIdentity       = require("./userIdentity")(sequelize, DataTypes);
const SubsubCategory     = require("./subsubCategory")(sequelize, DataTypes);
const UserSubsubCategory = require("./userSubsubCategory")(sequelize, DataTypes);

// Identities (M:N)
User.belongsToMany(Identity, { through: UserIdentity, as: "identities", foreignKey: "userId", otherKey: "identityId" });
Identity.belongsToMany(User, { through: UserIdentity, as: "users", foreignKey: "identityId", otherKey: "userId" });

// Level-3 taxonomy
Subcategory.hasMany(SubsubCategory, { as: "subsubs", foreignKey: "subcategoryId", onDelete: "CASCADE" });
SubsubCategory.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

//Category.hasMany(SubsubCategory, { as: "subsubs", foreignKey: "categoryId", onDelete: "CASCADE" });
//SubsubCategory.belongsTo(Category, { as: "category", foreignKey: "categoryId" });

// User ↔ SubsubCategory (M:N)
User.belongsToMany(SubsubCategory, { through: UserSubsubCategory, as: "subsubcategories", foreignKey: "userId", otherKey: "subsubCategoryId" });
SubsubCategory.belongsToMany(User, { through: UserSubsubCategory, as: "users", foreignKey: "subsubCategoryId", otherKey: "userId" });

// Jobs / Events (optional level-3 link)
Job.belongsTo(SubsubCategory,   { as: "subsubCategory", foreignKey: "subsubCategoryId" });
Event.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });

Identity.hasMany(Category, { foreignKey: "identityId", as: "categories", onDelete: "RESTRICT" });
Category.belongsTo(Identity, { foreignKey: "identityId", as: "identity" });

module.exports = {
  UserSubcategory, UserSubsubCategory,
  Identity, UserIdentity,
  Connection,
  ConnectionRequest,
  Notification,
  SubsubCategory,
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
