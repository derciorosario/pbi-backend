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
const Product = require("./product")(sequelize, DataTypes);
const Tourism = require("./tourism")(sequelize, DataTypes);
const Funding = require("./funding")(sequelize, DataTypes);
const Message = require("./message")(sequelize, DataTypes);
const Conversation = require("./conversation")(sequelize, DataTypes);
const MeetingRequest = require("./meetingRequest")(sequelize, DataTypes);

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

// Product
User.hasMany(Product, { foreignKey: "sellerUserId", as: "products" });
Product.belongsTo(User, { foreignKey: "sellerUserId", as: "seller" });

// Tourism
User.hasMany(Tourism, { foreignKey: "authorUserId", as: "tourismPosts" });
Tourism.belongsTo(User, { foreignKey: "authorUserId", as: "author" });

// Funding
User.hasMany(Funding, { foreignKey: "creatorUserId", as: "fundingProjects" });
Funding.belongsTo(User, { foreignKey: "creatorUserId", as: "creator" });
Funding.belongsTo(Category, { foreignKey: "categoryId", as: "category" });


const Connection        = require("./connection")(sequelize, DataTypes);
const ConnectionRequest = require("./connectionRequest")(sequelize, DataTypes);
const Notification      = require("./notification")(sequelize, DataTypes);

// Message associations
Message.belongsTo(User, { as: "sender", foreignKey: "senderId" });
Message.belongsTo(User, { as: "receiver", foreignKey: "receiverId" });
User.hasMany(Message, { as: "sentMessages", foreignKey: "senderId" });
User.hasMany(Message, { as: "receivedMessages", foreignKey: "receiverId" });

// Conversation associations
Conversation.belongsTo(User, { as: "user1", foreignKey: "user1Id" });
Conversation.belongsTo(User, { as: "user2", foreignKey: "user2Id" });
User.hasMany(Conversation, { as: "conversationsAsUser1", foreignKey: "user1Id" });
User.hasMany(Conversation, { as: "conversationsAsUser2", foreignKey: "user2Id" });


User.hasMany(ConnectionRequest, { foreignKey: "fromUserId", as: "sentRequests" });
User.hasMany(ConnectionRequest, { foreignKey: "toUserId",   as: "receivedRequests" });

User.hasMany(Connection, { foreignKey: "userOneId", as: "connectionsAsOne" });
User.hasMany(Connection, { foreignKey: "userTwoId", as: "connectionsAsTwo" });

Notification.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Notification,   { foreignKey: "userId", as: "notifications" });

// Meeting Request associations
MeetingRequest.belongsTo(User, { foreignKey: "fromUserId", as: "requester" });
MeetingRequest.belongsTo(User, { foreignKey: "toUserId", as: "recipient" });
User.hasMany(MeetingRequest, { foreignKey: "fromUserId", as: "sentMeetingRequests" });
User.hasMany(MeetingRequest, { foreignKey: "toUserId", as: "receivedMeetingRequests" });


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

// Product audience association models
const ProductIdentity       = require("./ProductIdentity")(sequelize, DataTypes);
const ProductCategory       = require("./ProductCategory")(sequelize, DataTypes);
const ProductSubcategory    = require("./ProductSubcategory")(sequelize, DataTypes);
const ProductSubsubCategory = require("./ProductSubsubCategory")(sequelize, DataTypes);

// Tourism audience association models
const TourismIdentity       = require("./TourismIdentity")(sequelize, DataTypes);
const TourismCategory       = require("./TourismCategory")(sequelize, DataTypes);
const TourismSubcategory    = require("./TourismSubcategory")(sequelize, DataTypes);
const TourismSubsubCategory = require("./TourismSubsubCategory")(sequelize, DataTypes);

// Funding audience association models
const FundingIdentity       = require("./FundingIdentity")(sequelize, DataTypes);
const FundingCategory       = require("./FundingCategory")(sequelize, DataTypes);
const FundingSubcategory    = require("./FundingSubcategory")(sequelize, DataTypes);
const FundingSubsubCategory = require("./FundingSubsubCategory")(sequelize, DataTypes);


// Interest join-tables (what the user is looking for)
const UserIdentityInterest       = require("./userIdentityInterest")(sequelize, DataTypes);
const UserCategoryInterest       = require("./userCategoryInterest")(sequelize, DataTypes);
const UserSubcategoryInterest    = require("./userSubcategoryInterest")(sequelize, DataTypes);
const UserSubsubCategoryInterest = require("./userSubsubCategoryInterest")(sequelize, DataTypes);




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

// Product audience associations
Product.belongsToMany(Identity, {
  through: "product_identities",
  foreignKey: "productId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Product, {
  through: "product_identities",
  foreignKey: "identityId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(Category, {
  through: "product_categories",
  foreignKey: "productId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Product, {
  through: "product_categories",
  foreignKey: "categoryId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(Subcategory, {
  through: "product_subcategories",
  foreignKey: "productId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Product, {
  through: "product_subcategories",
  foreignKey: "subcategoryId",
  otherKey: "productId",
  as: "products",
});

Product.belongsToMany(SubsubCategory, {
  through: "product_subsubcategories",
  foreignKey: "productId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Product, {
  through: "product_subsubcategories",
  foreignKey: "subsubCategoryId",
  otherKey: "productId",
  as: "products",
});


// Tourism audience associations
Tourism.belongsToMany(Identity, {
  through: {
    model: "tourism_identities",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Tourism, {
  through: {
    model: "tourism_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(Category, {
  through: {
    model: "tourism_categories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Tourism, {
  through: {
    model: "tourism_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(Subcategory, {
  through: {
    model: "tourism_subcategories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Tourism, {
  through: {
    model: "tourism_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

Tourism.belongsToMany(SubsubCategory, {
  through: {
    model: "tourism_subsubcategories",
    timestamps: false
  },
  foreignKey: "tourismId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Tourism, {
  through: {
    model: "tourism_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "tourismId",
  as: "tourismPosts",
});

// Funding audience associations
Funding.belongsToMany(Identity, {
  through: {
    model: "funding_identities",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "identityId",
  as: "audienceIdentities",
});
Identity.belongsToMany(Funding, {
  through: {
    model: "funding_identities",
    timestamps: false
  },
  foreignKey: "identityId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(Category, {
  through: {
    model: "funding_categories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "categoryId",
  as: "audienceCategories",
});
Category.belongsToMany(Funding, {
  through: {
    model: "funding_categories",
    timestamps: false
  },
  foreignKey: "categoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(Subcategory, {
  through: {
    model: "funding_subcategories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "subcategoryId",
  as: "audienceSubcategories",
});
Subcategory.belongsToMany(Funding, {
  through: {
    model: "funding_subcategories",
    timestamps: false
  },
  foreignKey: "subcategoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});

Funding.belongsToMany(SubsubCategory, {
  through: {
    model: "funding_subsubcategories",
    timestamps: false
  },
  foreignKey: "fundingId",
  otherKey: "subsubCategoryId",
  as: "audienceSubsubs",
});
SubsubCategory.belongsToMany(Funding, {
  through: {
    model: "funding_subsubcategories",
    timestamps: false
  },
  foreignKey: "subsubCategoryId",
  otherKey: "fundingId",
  as: "fundingProjects",
});





// --- Interest associations (optional but nice to have) ---
User.hasMany(UserIdentityInterest, { as: "identityInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserIdentityInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserIdentityInterest.belongsTo(Identity, { as: "identity", foreignKey: "identityId" });

User.hasMany(UserCategoryInterest, { as: "categoryInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserCategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserCategoryInterest.belongsTo(Category, { as: "category", foreignKey: "categoryId" });

User.hasMany(UserSubcategoryInterest, { as: "subcategoryInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserSubcategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserSubcategoryInterest.belongsTo(Subcategory, { as: "subcategory", foreignKey: "subcategoryId" });

User.hasMany(UserSubsubCategoryInterest, { as: "subsubInterests", foreignKey: "userId", onDelete: "CASCADE" });
UserSubsubCategoryInterest.belongsTo(User, { as: "user", foreignKey: "userId" });
UserSubsubCategoryInterest.belongsTo(SubsubCategory, { as: "subsubCategory", foreignKey: "subsubCategoryId" });


module.exports = {
   UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,


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
  NewsArticle,
  Goal,
  UserGoal,
  Event,
  Job,
  Message,
  Conversation,
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
  // Export product model and audience association models
  Product,
  ProductIdentity,
  ProductCategory,
  ProductSubcategory,
  ProductSubsubCategory,
  // Export tourism model and audience association models
  Tourism,
  TourismIdentity,
  TourismCategory,
  TourismSubcategory,
  TourismSubsubCategory,
  // Export funding model and audience association models
  Funding,
  FundingIdentity,
  FundingCategory,
  FundingSubcategory,
  FundingSubsubCategory,
  // Export meeting request model
  MeetingRequest,
};
