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
const Service = require("./service")(sequelize, DataTypes);

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

// Service
User.hasMany(Service, { foreignKey: "providerUserId", as: "services" });
Service.belongsTo(User, { foreignKey: "providerUserId", as: "provider" });

Service.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Service.belongsTo(Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });


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

// Jobs / Events / Services (optional level-3 link)
Job.belongsTo(SubsubCategory,   { as: "subsubCategory", foreignKey: "subsubCategoryId" });
Event.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });
Service.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });

Identity.hasMany(Category, { foreignKey: "identityId", as: "categories", onDelete: "RESTRICT" });
Category.belongsTo(Identity, { foreignKey: "identityId", as: "identity" });


const JobIdentity       = require("./JobIdentity")(sequelize, DataTypes);
const JobCategory       = require("./JobCategory")(sequelize, DataTypes);
const JobSubcategory    = require("./JobSubcategory")(sequelize, DataTypes);
const JobSubsubCategory = require("./jobSubsubCategory")(sequelize, DataTypes);

// Event audience association models
const EventIdentity       = require("./EventIdentity")(sequelize, DataTypes);
const EventCategory       = require("./EventCategory")(sequelize, DataTypes);
const EventSubcategory    = require("./EventSubcategory")(sequelize, DataTypes);
const EventSubsubCategory = require("./EventSubsubCategory")(sequelize, DataTypes);

// Service audience association models
const ServiceIdentity       = require("./ServiceIdentity")(sequelize, DataTypes);
const ServiceCategory       = require("./ServiceCategory")(sequelize, DataTypes);
const ServiceSubcategory    = require("./ServiceSubcategory")(sequelize, DataTypes);
const ServiceSubsubCategory = require("./ServiceSubsubCategory")(sequelize, DataTypes);


Job.belongsToMany(Identity, {
  through: "job_identities",
  foreignKey: "jobId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Job, {
  through: "job_identities",
  foreignKey: "identityId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(Category, {
  through: "job_categories",
  foreignKey: "jobId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Job, {
  through: "job_categories",
  foreignKey: "categoryId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(Subcategory, {
  through: "job_subcategories",
  foreignKey: "jobId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Job, {
  through: "job_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "jobId",
  as: "jobs",
});

Job.belongsToMany(SubsubCategory, {
  through: "job_subsubcategories",
  foreignKey: "jobId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Job, {
  through: "job_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "jobId",
  as: "jobs",
});

// Event audience associations
Event.belongsToMany(Identity, {
  through: "event_identities",
  foreignKey: "eventId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Event, {
  through: "event_identities",
  foreignKey: "identityId",
  otherKey: "eventId",
  as: "events",
});

Event.belongsToMany(Category, {
  through: "event_categories",
  foreignKey: "eventId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Event, {
  through: "event_categories",
  foreignKey: "categoryId",
  otherKey: "eventId",
  as: "events",
});

Event.belongsToMany(Subcategory, {
  through: "event_subcategories",
  foreignKey: "eventId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Event, {
  through: "event_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "eventId",
  as: "events",
});

Event.belongsToMany(SubsubCategory, {
  through: "event_subsubcategories",
  foreignKey: "eventId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Event, {
  through: "event_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "eventId",
  as: "events",
});

// Service audience associations
Service.belongsToMany(Identity, {
  through: "service_identities",
  foreignKey: "serviceId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Service, {
  through: "service_identities",
  foreignKey: "identityId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(Category, {
  through: "service_categories",
  foreignKey: "serviceId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Service, {
  through: "service_categories",
  foreignKey: "categoryId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(Subcategory, {
  through: "service_subcategories",
  foreignKey: "serviceId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Service, {
  through: "service_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "serviceId",
  as: "services",
});

Service.belongsToMany(SubsubCategory, {
  through: "service_subsubcategories",
  foreignKey: "serviceId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Service, {
  through: "service_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "serviceId",
  as: "services",
});


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
  // Export event audience association models
  EventIdentity,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
  // Export service model and audience association models
  Service,
  ServiceIdentity,
  ServiceCategory,
  ServiceSubcategory,
  ServiceSubsubCategory,
};
