// src/seeds/seedUsers.js
require("dotenv").config();

const {
  sequelize,
  User,
  Profile,
  Category,
  Subcategory,
  SubsubCategory,
  Identity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  UserIdentity,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  Goal,
  UserGoal,
} = require("../models");

const bcrypt = require("bcryptjs");
/* -------------------------------- Catalogs -------------------------------- */

// Load data from identity_category_map.json
const fs = require("fs");
const path = require("path");
const identityCategoryMapPath = path.join(__dirname, "../../seed/identity_category_map.json");
const identityCategoryMap = JSON.parse(fs.readFileSync(identityCategoryMapPath, "utf8"));

// Extract goals from identity_category_map.json
const GOALS_CATALOG = identityCategoryMap.goals || [
  "Hire Engineers",
  "Find Investors",
  "Raise Capital",
  "Find Clients",
  "Partnerships",
  "Mentorship",
  "Recruitment",
  "Find Co-founder",
  "Job Opportunities",
  "Sell Products/Services",
];

/* -------------------------------- Helpers --------------------------------- */

async function hash(pwd = "ChangeMe@123") {
  return bcrypt.hash(pwd, 10);
}

async function ensureCategoriesIfEmpty() {
  const count = await Category.count();
  if (count > 0) return;

  // Extract unique categories from identity_category_map.json
  const categories = new Set();
  const categorySubcategories = new Map();

  for (const identity of identityCategoryMap.identities || []) {
    for (const category of identity.categories || []) {
      categories.add(category.name);
      
      if (!categorySubcategories.has(category.name)) {
        categorySubcategories.set(category.name, new Set());
      }
      
      for (const subcategory of category.subcategories || []) {
        categorySubcategories.get(category.name).add(subcategory.name);
      }
    }
  }

  // Create categories and subcategories
  for (const categoryName of categories) {
    const category = await Category.create({ name: categoryName });
    
    if (categorySubcategories.has(categoryName)) {
      for (const subcategoryName of categorySubcategories.get(categoryName)) {
        await Subcategory.create({ name: subcategoryName, categoryId: category.id });
      }
    }
  }
  
  console.log(`✅ Seeded ${categories.size} categories (because DB had none).`);
}

async function ensureGoalsIfEmpty() {
  const count = await Goal.count();
  if (count > 0) return;
  await Goal.bulkCreate(GOALS_CATALOG.map((name) => ({ name })));
  console.log(`✅ Seeded ${GOALS_CATALOG.length} goals (because DB had none).`);
}

async function ensureIdentitiesIfEmpty() {
  const count = await Identity.count();
  if (count > 0) return;
  
  const identities = identityCategoryMap.identities || [];
  await Identity.bulkCreate(identities.map(identity => ({ name: identity.name })));
  
  console.log(`✅ Seeded ${identities.length} identities (because DB had none).`);
}

async function findCategoryIdsByNames(names = []) {
  if (!names.length) return [];
  const rows = await Category.findAll({ where: { name: names } });
  return rows.map((r) => r.id);
}

async function findSubcategoryIdsByNames(pairs = []) {
  // pairs: [{ categoryName, subName }]
  const out = [];
  for (const { categoryName, subName } of pairs) {
    const cat = await Category.findOne({ where: { name: categoryName } });
    if (!cat) continue;
    const sub = await Subcategory.findOne({
      where: { name: subName, categoryId: cat.id },
    });
    if (sub) out.push(sub.id);
  }
  return out;
}

async function findSubsubCategoryIdsByNames(triples = []) {
  // triples: [{ categoryName, subName, subsubName }]
  const out = [];
  for (const { categoryName, subName, subsubName } of triples) {
    const cat = await Category.findOne({ where: { name: categoryName } });
    if (!cat) {
      console.log(`Category not found: ${categoryName}`);
      continue;
    }
    
    const sub = await Subcategory.findOne({
      where: { name: subName, categoryId: cat.id },
    });
    if (!sub) {
      console.log(`Subcategory not found: ${subName} in category ${categoryName}`);
      continue;
    }
    
    const subsub = await SubsubCategory.findOne({
      where: { name: subsubName, subcategoryId: sub.id },
    });
    if (subsub) {
      out.push(subsub.id);
    } else {
      console.log(`SubsubCategory not found: ${subsubName} in subcategory ${subName}`);
      
      // Create the subsubcategory if it doesn't exist
      try {
        const newSubsub = await SubsubCategory.create({
          name: subsubName,
          subcategoryId: sub.id
        });
        out.push(newSubsub.id);
        console.log(`Created subsubcategory: ${subsubName}`);
      } catch (error) {
        console.error(`Failed to create subsubcategory ${subsubName}:`, error.message);
      }
    }
  }
  return out;
}

async function findIdentityIdsByNames(names = []) {
  if (!names.length) return [];
  const rows = await Identity.findAll({ where: { name: names } });
  return rows.map((r) => r.id);
}

async function findGoalIdsByNames(names = []) {
  if (!names.length) return [];
  const rows = await Goal.findAll({ where: { name: names } });
  return rows.map((g) => g.id);
}

/**
 * Cria/atualiza User + Profile e associa categorias, subcategorias, subsubcategorias, identidades e goals.
 */
async function upsertUserWithProfile({
  email,
  password = "User@123",
  name,
  phone,
  nationality,
  country,
  countryOfResidence,
  city,
  accountType = "individual",
  profile = {},
  categories = [],
  subcategories = [],
  subsubcategories = [],
  identities = [],
  categoryInterests = [],
  subcategoryInterests = [],
  subsubcategoryInterests = [],
  identityInterests = [],
  goals = [], // <<--- array de nomes de goals
}) {
  const passwordHash = await hash(password);

  let user = await User.findOne({ where: { email } });
  if (!user) {
    user = await User.create({
      email,
      passwordHash,
      name,
      phone,
      nationality,
      country,
      countryOfResidence,
      city,
      accountType,
      isVerified: true,
    });
    console.log(`👤 Created user: ${email}`);
  } else {
    await user.save();
    console.log(`ℹ️  User already exists: ${email}`);
  }

  // Profile
  let prof = await Profile.findOne({ where: { userId: user.id } });
  if (!prof) {
    prof = await Profile.create({
      userId: user.id,
      primaryIdentity: profile.primaryIdentity || null,
      professionalTitle: profile.professionalTitle || null,
      about: profile.about || null,
      avatarUrl: profile.avatarUrl || null,
      birthDate: profile.birthDate || null,
      experienceLevel: profile.experienceLevel || null,
      skills: profile.skills || [],
      languages: profile.languages || [],
      categoryId: null,
      subcategoryId: null,
      onboardingProfileTypeDone: !!profile.primaryIdentity,
      onboardingCategoriesDone:
        categories.length > 0 || subcategories.length > 0,
      onboardingGoalsDone: goals.length > 0,
    });
    console.log(`🧩 Profile created for: ${email}`);
  } else {
    Object.assign(prof, {
      primaryIdentity: profile.primaryIdentity ?? prof.primaryIdentity,
      professionalTitle: profile.professionalTitle ?? prof.professionalTitle,
      about: profile.about ?? prof.about,
      avatarUrl: profile.avatarUrl ?? prof.avatarUrl,
      birthDate: profile.birthDate ?? prof.birthDate,
      experienceLevel: profile.experienceLevel ?? prof.experienceLevel,
      skills: Array.isArray(profile.skills) ? profile.skills : prof.skills,
      languages: Array.isArray(profile.languages)
        ? profile.languages
        : prof.languages,
      onboardingGoalsDone:
        typeof prof.onboardingGoalsDone === "boolean"
          ? prof.onboardingGoalsDone || goals.length > 0
          : goals.length > 0,
    });
    await prof.save();
    console.log(`🛠️  Profile updated for: ${email}`);
  }

  // Categorias/Subcategorias/SubsubCategorias/Identidades (M2M)
  if (categories.length || subcategories.length || subsubcategories.length || identities.length) {
    const catIds = await findCategoryIdsByNames(categories);
    const subIds = await findSubcategoryIdsByNames(subcategories);
    const subsubIds = await findSubsubCategoryIdsByNames(subsubcategories);
    const identityIds = await findIdentityIdsByNames(identities);

    // Clear previous associations
    await UserCategory.destroy({ where: { userId: user.id } });
    await UserSubcategory.destroy({ where: { userId: user.id } });
    await UserSubsubCategory.destroy({ where: { userId: user.id } });
    await UserIdentity.destroy({ where: { userId: user.id } });

    // Create new associations
    if (catIds.length) {
      await UserCategory.bulkCreate(
        catIds.map((cid) => ({ userId: user.id, categoryId: cid }))
      );
    }
    if (subIds.length) {
      await UserSubcategory.bulkCreate(
        subIds.map((sid) => ({ userId: user.id, subcategoryId: sid }))
      );
    }
    if (subsubIds.length) {
      await UserSubsubCategory.bulkCreate(
        subsubIds.map((ssid) => ({ userId: user.id, subsubCategoryId: ssid }))
      );
    }
    if (identityIds.length) {
      await UserIdentity.bulkCreate(
        identityIds.map((iid) => ({ userId: user.id, identityId: iid }))
      );
    }

    console.log(
      `🔗 Linked ${catIds.length} categories, ${subIds.length} subcategories, ${subsubIds.length} subsubcategories, and ${identityIds.length} identities to ${email}`
    );
  }

  // Interests (M2M)
  if (categoryInterests.length || subcategoryInterests.length || subsubcategoryInterests.length || identityInterests.length) {
    const catIds = await findCategoryIdsByNames(categoryInterests);
    const subIds = await findSubcategoryIdsByNames(subcategoryInterests);
    const subsubIds = await findSubsubCategoryIdsByNames(subsubcategoryInterests);
    const identityIds = await findIdentityIdsByNames(identityInterests);

    // Clear previous interests
    await UserCategoryInterest.destroy({ where: { userId: user.id } });
    await UserSubcategoryInterest.destroy({ where: { userId: user.id } });
    await UserSubsubCategoryInterest.destroy({ where: { userId: user.id } });
    await UserIdentityInterest.destroy({ where: { userId: user.id } });

    // Create new interests
    if (catIds.length) {
      await UserCategoryInterest.bulkCreate(
        catIds.map((cid) => ({ userId: user.id, categoryId: cid }))
      );
    }
    if (subIds.length) {
      await UserSubcategoryInterest.bulkCreate(
        subIds.map((sid) => ({ userId: user.id, subcategoryId: sid }))
      );
    }
    if (subsubIds.length) {
      await UserSubsubCategoryInterest.bulkCreate(
        subsubIds.map((ssid) => ({ userId: user.id, subsubCategoryId: ssid }))
      );
    }
    if (identityIds.length) {
      await UserIdentityInterest.bulkCreate(
        identityIds.map((iid) => ({ userId: user.id, identityId: iid }))
      );
    }

    console.log(
      `🔗 Linked ${catIds.length} category interests, ${subIds.length} subcategory interests, ${subsubIds.length} subsubcategory interests, and ${identityIds.length} identity interests to ${email}`
    );
  }

  // Goals (M2M)
  if (goals.length) {
    const goalIds = await findGoalIdsByNames(goals);

    // remove prev e adiciona os novos
    await UserGoal.destroy({ where: { userId: user.id } });
    if (goalIds.length) {
      await UserGoal.bulkCreate(
        goalIds.map((gid) => ({ userId: user.id, goalId: gid }))
      );
    }

    console.log(`🎯 Linked ${goalIds.length} goals to ${email}`);
  }

  return user;
}

/* --------------------------------- Data ----------------------------------- */

const BULK_USERS = [
  // Companies
  {
    email: "afri-agro@54links.com",
    password: "Company@123",
    name: "AfriAgro Ltd.",
    phone: "+234 01 222 7788",
    nationality: "Nigerian",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    city: "Lagos",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "Agri-processing & Export",
      about: "We process and export cashews and cocoa with tech-enabled logistics.",
      experienceLevel: "Director",
      skills: ["Supply Chain", "Export", "B2B Sales"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    identities: ["Entrepreneur (Startups)"],
    categories: ["Agriculture", "Commerce & Financial Services"],
    subcategories: [
      { categoryName: "Agriculture", subName: "Agro-Processing" },
      {
        categoryName: "Commerce & Financial Services",
        subName: "Investment & Capital Markets",
      },
    ],
    subsubcategories: [
      { categoryName: "Trade", subName: "Food & Beverage", subsubName: "Beverages" }
    ],
    categoryInterests: ["Technology", "Energy"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Fintech" },
      { categoryName: "Energy", subName: "Renewable Energy" }
    ],
    identityInterests: ["Investor", "Professional"],
    goals: ["Find Clients", "Partnerships", "Raise Capital"],
  },
  {
    email: "tech-innovate@54links.com",
    password: "Company@123",
    name: "TechInnovate Solutions",
    phone: "+27 11 555 1234",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Johannesburg",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "AI & Machine Learning Solutions",
      about: "Developing cutting-edge AI solutions for businesses across Africa.",
      experienceLevel: "Director",
      skills: ["Machine Learning", "AI", "Data Science", "Cloud Computing"],
      languages: [{ name: "English", level: "Native" }],
    },
    identities: ["Entrepreneur (Startups)"],
    categories: ["Technology", "Professional Services"],
    subcategories: [
      { categoryName: "Technology", subName: "Artificial Intelligence" },
      { categoryName: "Technology", subName: "Data Science & Analysis" },
      { categoryName: "Professional Services", subName: "Consulting" },
    ],
    subsubcategories: [
      { categoryName: "Technology", subName: "Artificial Intelligence", subsubName: "Machine Learning" },
      { categoryName: "Technology", subName: "Data Science & Analysis", subsubName: "Big Data" }
    ],
    categoryInterests: ["Education", "Health"],
    subcategoryInterests: [
      { categoryName: "Education", subName: "EdTech" },
      { categoryName: "Health", subName: "Health Tech" }
    ],
    identityInterests: ["Investor", "Professional"],
    goals: ["Hire Engineers", "Find Clients", "Raise Capital"],
  },
  {
    email: "green-energy@54links.com",
    password: "Company@123",
    name: "GreenEnergy Africa",
    phone: "+254 20 555 6789",
    nationality: "Kenyan",
    country: "Kenya",
    countryOfResidence: "Kenya",
    city: "Nairobi",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "Renewable Energy Solutions",
      about: "Providing affordable solar and wind energy solutions across East Africa.",
      experienceLevel: "Director",
      skills: ["Solar Energy", "Wind Energy", "Sustainability", "Project Management"],
      languages: [{ name: "English", level: "Advanced" }, { name: "Swahili", level: "Native" }],
    },
    identities: ["Entrepreneur (Startups)"],
    categories: ["Energy", "Infrastructure & Construction"],
    subcategories: [
      { categoryName: "Energy", subName: "Renewable Energy" },
      { categoryName: "Energy", subName: "Clean Tech / Green Energy Solutions" },
      { categoryName: "Infrastructure & Construction", subName: "Civil Engineering & Roads" },
    ],
    subsubcategories: [
      { categoryName: "Energy", subName: "Renewable Energy", subsubName: "Solar" },
      { categoryName: "Energy", subName: "Renewable Energy", subsubName: "Wind" }
    ],
    categoryInterests: ["Technology", "Manufacturing"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Hardware & Devices" },
      { categoryName: "Manufacturing", subName: "Machinery & Equipment" }
    ],
    identityInterests: ["Investor", "Government Officials"],
    goals: ["Find Investors", "Partnerships", "Raise Capital"],
  },
  {
    email: "sa-renew@54links.com",
    password: "Company@123",
    name: "SA Renewables",
    phone: "+27 21 555 9000",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Cape Town",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "Solar EPC",
      about: "Utility-scale solar and hybrid storage projects across SADC.",
      experienceLevel: "Director",
      skills: ["Solar", "EPC", "Grid"],
      languages: [{ name: "English", level: "Native" }],
    },
    categories: ["Energy", "Infrastructure & Construction"],
    subcategories: [
      { categoryName: "Energy", subName: "Renewable Energy (Solar, Wind, Hydro)" },
      { categoryName: "Infrastructure & Construction", subName: "Civil Engineering & Roads" },
    ],
    goals: ["Find Investors", "Partnerships"],
  },
  {
    email: "naija-fintech@54links.com",
    password: "Company@123",
    name: "NaijaPay",
    phone: "+234 80 777 2222",
    nationality: "Nigerian",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    city: "Abuja",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "Fintech Payments",
      about: "Digital payment solutions for SMEs and marketplaces.",
      experienceLevel: "Lead",
      skills: ["Payments", "Fintech", "Mobile"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    categories: ["Technology", "E-Commerce", "Commerce & Financial Services"],
    subcategories: [
      { categoryName: "Technology", subName: "Fintech" },
      { categoryName: "E-Commerce", subName: "Digital Payment Solutions" },
      { categoryName: "Commerce & Financial Services", subName: "Banking" },
    ],
    goals: ["Find Clients", "Hire Engineers", "Raise Capital"],
  },
  {
    email: "kenya-logistics@54links.com",
    password: "Company@123",
    name: "Kilima Logistics",
    phone: "+254 700 111 333",
    nationality: "Kenyan",
    country: "Kenya",
    countryOfResidence: "Kenya",
    city: "Nairobi",
    accountType: "company",
    profile: {
      primaryIdentity: "Entrepreneur",
      professionalTitle: "3PL & E-comm Logistics",
      about: "B2B/B2C last-mile across East Africa with real-time tracking.",
      experienceLevel: "Director",
      skills: ["Logistics", "Warehousing", "Tracking"],
      languages: [{ name: "English", level: "Advanced" }, { name: "Swahili", level: "Native" }],
    },
    categories: ["E-Commerce", "Maritime & Transport"],
    subcategories: [
      { categoryName: "E-Commerce", subName: "Logistics & Delivery Services" },
      { categoryName: "Maritime & Transport", subName: "Freight & Delivery Services" },
    ],
    goals: ["Find Clients", "Partnerships"],
  },

  // Individuals
  {
    email: "amara.dev@54links.com",
    password: "User@123",
    name: "Amara N.",
    phone: "+234 803 555 1010",
    nationality: "Nigerian",
    country: "Nigeria",
    countryOfResidence: "Ghana",
    city: "Accra",
    accountType: "individual",
    profile: {
      primaryIdentity: "Job Seeker",
      professionalTitle: "Frontend Engineer",
      about: "React/Next.js, performance-first. 4 years exp.",
      experienceLevel: "Mid",
      skills: ["React", "Next.js", "Tailwind"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    identities: ["Professional"],
    categories: ["Technology"],
    subcategories: [{ categoryName: "Technology", subName: "Software Development" }],
    subsubcategories: [
      { categoryName: "Technology", subName: "Software Development", subsubName: "Frontend" }
    ],
    categoryInterests: ["Technology"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Software Development" },
      { categoryName: "Technology", subName: "Mobile App Developer" }
    ],
    identityInterests: ["Professional", "Freelancers"],
    goals: ["Job Opportunities", "Mentorship"],
  },
  {
    email: "samuel.data@54links.com",
    password: "User@123",
    name: "Samuel K.",
    phone: "+27 71 555 8989",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Cape Town",
    accountType: "individual",
    profile: {
      primaryIdentity: "Professional",
      professionalTitle: "Data Scientist",
      about: "Machine learning specialist with focus on NLP and computer vision.",
      experienceLevel: "Senior",
      skills: ["Python", "TensorFlow", "PyTorch", "Computer Vision", "NLP"],
      languages: [{ name: "English", level: "Native" }],
    },
    identities: ["Professional"],
    categories: ["Technology"],
    subcategories: [
      { categoryName: "Technology", subName: "Data Science & Analysis" },
      { categoryName: "Technology", subName: "Artificial Intelligence" }
    ],
    subsubcategories: [
      { categoryName: "Technology", subName: "Data Science & Analysis", subsubName: "Machine Learning" },
      { categoryName: "Technology", subName: "Artificial Intelligence", subsubName: "NLP" }
    ],
    categoryInterests: ["Technology", "Health"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Data Science & Analysis" },
      { categoryName: "Health", subName: "Health Tech" }
    ],
    identityInterests: ["Professional", "Entrepreneur (Startups)"],
    goals: ["Find Clients", "Mentorship", "Partnerships"],
  },
  {
    email: "fatima.finance@54links.com",
    password: "User@123",
    name: "Fatima M.",
    phone: "+212 661 555 4321",
    nationality: "Moroccan",
    country: "Morocco",
    countryOfResidence: "Morocco",
    city: "Casablanca",
    accountType: "individual",
    profile: {
      primaryIdentity: "Professional",
      professionalTitle: "Financial Analyst",
      about: "Investment analysis and portfolio management specialist with focus on emerging markets.",
      experienceLevel: "Senior",
      skills: ["Financial Analysis", "Investment Management", "Risk Assessment", "Market Research"],
      languages: [{ name: "Arabic", level: "Native" }, { name: "French", level: "Advanced" }, { name: "English", level: "Advanced" }],
    },
    identities: ["Professional"],
    categories: ["Commerce & Financial Services"],
    subcategories: [
      { categoryName: "Commerce & Financial Services", subName: "Investment & Capital Markets" },
      { categoryName: "Commerce & Financial Services", subName: "Banking" }
    ],
    subsubcategories: [
      { categoryName: "Commerce & Financial Services", subName: "Investment & Capital Markets", subsubName: "Portfolio Management" }
    ],
    categoryInterests: ["Technology", "Commerce & Financial Services"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Fintech" },
      { categoryName: "Commerce & Financial Services", subName: "Investment & Capital Markets" }
    ],
    identityInterests: ["Professional", "Investor"],
    goals: ["Find Clients", "Partnerships", "Mentorship"],
  },
  {
    email: "amina.designer@54links.com",
    password: "User@123",
    name: "Amina A.",
    phone: "+254 712 555 1212",
    nationality: "Kenyan",
    country: "Kenya",
    countryOfResidence: "Kenya",
    city: "Nairobi",
    accountType: "individual",
    profile: {
      primaryIdentity: "Freelancers",
      professionalTitle: "Brand & UI Designer",
      about: "Brand systems, UI libraries, web flows for startups.",
      experienceLevel: "Senior",
      skills: ["Figma", "Branding", "UI/UX"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    categories: ["Marketing & Advertising", "Technology"],
    subcategories: [
      { categoryName: "Marketing & Advertising", subName: "Branding & Creative Strategy" },
      { categoryName: "Technology", subName: "Software Development" },
    ],
    goals: ["Find Clients", "Partnerships", "Mentorship"],
  },
  {
    email: "youssef.data@54links.com",
    password: "User@123",
    name: "Youssef E.",
    phone: "+212 600 777 888",
    nationality: "Moroccan",
    country: "Morocco",
    countryOfResidence: "Morocco",
    city: "Casablanca",
    accountType: "individual",
    profile: {
      primaryIdentity: "Professional",
      professionalTitle: "Data Analyst",
      about: "Dashboards, SQL pipelines, marketing attribution.",
      experienceLevel: "Mid",
      skills: ["SQL", "Python", "PowerBI"],
      languages: [{ name: "Arabic", level: "Native" }, { name: "French", level: "Advanced" }],
    },
    categories: ["Technology", "Marketing & Advertising"],
    subcategories: [
      { categoryName: "Technology", subName: "Data Analysis" },
      { categoryName: "Marketing & Advertising", subName: "Market Research & Analytics" },
    ],
    goals: ["Find Clients", "Mentorship"],
  },
  {
    email: "chinedu.hr@54links.com",
    password: "User@123",
    name: "Chinedu O.",
    phone: "+234 802 999 1234",
    nationality: "Nigerian",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    city: "Enugu",
    accountType: "individual",
    profile: {
      primaryIdentity: "Recruiter",
      professionalTitle: "Tech Recruiter",
      about: "Placing engineers across Lagos, Accra, Nairobi.",
      experienceLevel: "Lead",
      skills: ["Sourcing", "ATS", "Interviewing"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    categories: ["Professional Services"],
    subcategories: [{ categoryName: "Professional Services", subName: "Human Resources" }],
    goals: ["Recruitment", "Find Clients"],
  },
  {
    email: "helena.events@54links.com",
    password: "User@123",
    name: "Helena M.",
    phone: "+27 71 333 2222",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Durban",
    accountType: "individual",
    profile: {
      primaryIdentity: "Event Organizer",
      professionalTitle: "Conference Producer",
      about: "B2B conferences, trade shows & activations.",
      experienceLevel: "Senior",
      skills: ["Event Marketing & Activations", "Sponsorships"],
      languages: [{ name: "English", level: "Native" }],
    },
    categories: ["Tourism & Hospitality", "Marketing & Advertising"],
    subcategories: [
      { categoryName: "Tourism & Hospitality", subName: "Event Management" },
      { categoryName: "Marketing & Advertising", subName: "Event Marketing & Activations" },
    ],
    goals: ["Find Clients", "Partnerships"],
  },

  // Social Entrepreneurs
  {
    email: "eco-solutions@54links.com",
    password: "User@123",
    name: "EcoSolutions Africa",
    phone: "+255 755 555 1234",
    nationality: "Tanzanian",
    country: "Tanzania",
    countryOfResidence: "Tanzania",
    city: "Dar es Salaam",
    accountType: "company",
    profile: {
      primaryIdentity: "Social Entrepreneurs",
      professionalTitle: "Environmental Solutions Provider",
      about: "Developing sustainable waste management solutions for urban areas in East Africa.",
      experienceLevel: "Mid",
      skills: ["Waste Management", "Recycling", "Environmental Impact Assessment", "Community Engagement"],
      languages: [{ name: "English", level: "Advanced" }, { name: "Swahili", level: "Native" }],
    },
    identities: ["Social Entrepreneurs"],
    categories: ["Environment & Climate Action", "Social Enterprise"],
    subcategories: [
      { categoryName: "Environment & Climate Action", subName: "Waste Management" },
      { categoryName: "Social Enterprise", subName: "Environment & Climate Action" }
    ],
    subsubcategories: [
      { categoryName: "Environment & Climate Action", subName: "Waste Management", subsubName: "Recycling" }
    ],
    categoryInterests: ["Technology", "Manufacturing"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Clean Tech / Green Energy Solutions" },
      { categoryName: "Manufacturing", subName: "Sustainable Manufacturing" }
    ],
    identityInterests: ["Social Entrepreneurs", "Investor"],
    goals: ["Find Investors", "Partnerships", "Mentorship"],
  },
  
  // Freelancers
  {
    email: "zainab.design@54links.com",
    password: "User@123",
    name: "Zainab H.",
    phone: "+20 100 555 7890",
    nationality: "Egyptian",
    country: "Egypt",
    countryOfResidence: "Egypt",
    city: "Cairo",
    accountType: "individual",
    profile: {
      primaryIdentity: "Freelancers",
      professionalTitle: "UX/UI Designer",
      about: "Creating intuitive and beautiful digital experiences for web and mobile applications.",
      experienceLevel: "Senior",
      skills: ["UI Design", "UX Research", "Wireframing", "Prototyping", "Design Systems"],
      languages: [{ name: "Arabic", level: "Native" }, { name: "English", level: "Advanced" }],
    },
    identities: ["Freelancers"],
    categories: ["Design & Creative", "Technology"],
    subcategories: [
      { categoryName: "Design & Creative", subName: "UI/UX Designer" },
      { categoryName: "Technology", subName: "Software Development" }
    ],
    subsubcategories: [
      { categoryName: "Design & Creative", subName: "UI/UX Designer", subsubName: "Mobile Design" }
    ],
    categoryInterests: ["Technology", "Marketing & Advertising"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Software Development" },
      { categoryName: "Marketing & Advertising", subName: "Branding & Creative Strategy" }
    ],
    identityInterests: ["Freelancers", "Entrepreneur (Startups)"],
    goals: ["Find Clients", "Partnerships", "Mentorship"],
  },
  
  // Students
  {
    email: "kwame.student@54links.com",
    password: "User@123",
    name: "Kwame O.",
    phone: "+233 24 555 6789",
    nationality: "Ghanaian",
    country: "Ghana",
    countryOfResidence: "Ghana",
    city: "Accra",
    accountType: "individual",
    profile: {
      primaryIdentity: "Students",
      professionalTitle: "Computer Science Student",
      about: "Final year computer science student with focus on AI and machine learning.",
      experienceLevel: "Entry",
      skills: ["Python", "Machine Learning", "Web Development", "Data Analysis"],
      languages: [{ name: "English", level: "Advanced" }],
    },
    identities: ["Students"],
    categories: ["Education", "Technology"],
    subcategories: [
      { categoryName: "Education", subName: "IT & Computer Science" },
      { categoryName: "Technology", subName: "Artificial Intelligence" }
    ],
    subsubcategories: [
      { categoryName: "Education", subName: "IT & Computer Science", subsubName: "Undergraduate" }
    ],
    categoryInterests: ["Technology", "Education"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Artificial Intelligence" },
      { categoryName: "Technology", subName: "Software Development" }
    ],
    identityInterests: ["Students", "Professional"],
    goals: ["Internship", "Mentorship", "Job Opportunities"],
  },
  
  // Investors
  {
    email: "venture-capital@54links.com",
    password: "User@123",
    name: "Pan-African Ventures",
    phone: "+27 11 555 9876",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Johannesburg",
    accountType: "company",
    profile: {
      primaryIdentity: "Investor",
      professionalTitle: "Venture Capital Firm",
      about: "Early-stage investment in African tech startups with focus on fintech, healthtech, and agritech.",
      experienceLevel: "Director",
      skills: ["Investment Analysis", "Due Diligence", "Portfolio Management", "Startup Mentoring"],
      languages: [{ name: "English", level: "Native" }],
    },
    identities: ["Investor"],
    categories: ["Finance & Fintech", "Technology"],
    subcategories: [
      { categoryName: "Finance & Fintech", subName: "Venture Capital" },
      { categoryName: "Technology", subName: "Fintech" }
    ],
    subsubcategories: [
      { categoryName: "Finance & Fintech", subName: "Venture Capital", subsubName: "Early Stage" }
    ],
    categoryInterests: ["Technology", "Health", "Agriculture"],
    subcategoryInterests: [
      { categoryName: "Technology", subName: "Fintech" },
      { categoryName: "Health", subName: "Health Tech" },
      { categoryName: "Agriculture", subName: "Agro-Tech" }
    ],
    identityInterests: ["Investor", "Entrepreneur (Startups)"],
    goals: ["Find Investments", "Partnerships", "Mentorship"],
  },
  
  // Admins (não aparecem em sugestões/feeds para usuário)
  {
    email: "ops.admin@54links.com",
    password: "Admin@123",
    name: "54Links Ops",
    phone: "+27 10 200 0000",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Pretoria",
    accountType: "admin",
    profile: {
      primaryIdentity: "Other",
      professionalTitle: "Operations Admin",
      about: "Platform operations, moderation, policy.",
      experienceLevel: "Lead",
      skills: ["Ops", "Moderation", "Support"],
      languages: [{ name: "English", level: "Native" }],
    },
    categories: ["Public Sector", "Professional Services"],
    subcategories: [
      { categoryName: "Public Sector", subName: "Policy & Regulation" },
      { categoryName: "Professional Services", subName: "Consulting" },
    ],
    goals: ["Recruitment"],
  },
  {
    email: "content.admin@54links.com",
    password: "Admin@123",
    name: "54Links Content Admin",
    phone: "+27 10 200 0001",
    nationality: "South African",
    country: "South Africa",
    countryOfResidence: "South Africa",
    city: "Johannesburg",
    accountType: "admin",
    profile: {
      primaryIdentity: "Other",
      professionalTitle: "Content Admin",
      about: "Editorial quality, curation and compliance.",
      experienceLevel: "Senior",
      skills: ["Editorial", "Curation", "Compliance"],
      languages: [{ name: "English", level: "Native" }],
    },
    categories: ["Media & Entertainment", "Education"],
    subcategories: [
      {
        categoryName: "Media & Entertainment",
        subName: "Publishing (Books, Magazines, Digital Publishing",
      },
      { categoryName: "Education", subName: "EdTech" },
    ],
    goals: ["Mentorship"],
  },
];

/* --------------------------------- Main ----------------------------------- */

// Function to seed users with identities, categories, subcategories, and subsubcategories from identity_category_map.json
async function seedUsersFromIdentityCategoryMap() {
  try {
    // Create a sample user for each identity
    for (const identity of identityCategoryMap.identities || []) {
      const identityName = identity.name;
      
      // Create sample categories, subcategories, and subsubcategories for this identity
      const sampleCategories = [];
      const sampleSubcategories = [];
      const sampleSubsubcategories = [];
      
      // Take up to 2 categories for each identity
      const categoriesToUse = identity.categories.slice(0, 2);
      
      for (const category of categoriesToUse) {
        sampleCategories.push(category.name);
        
        // Take up to 2 subcategories for each category
        const subcategoriesToUse = (category.subcategories || []).slice(0, 2);
        
        for (const subcategory of subcategoriesToUse) {
          sampleSubcategories.push({
            categoryName: category.name,
            subName: subcategory.name
          });
          
          // Take up to 2 subsubcategories for each subcategory if they exist
          if (subcategory.subsubs && subcategory.subsubs.length > 0) {
            const subsubsToUse = subcategory.subsubs.slice(0, 2);
            
            for (const subsubName of subsubsToUse) {
              sampleSubsubcategories.push({
                categoryName: category.name,
                subName: subcategory.name,
                subsubName: subsubName
              });
              console.log(`Adding subsubcategory: ${subsubName} in subcategory ${subcategory.name}`);
            }
          } else {
            // If no subsubs exist, create a default one
            const defaultSubsubName = `Default ${subcategory.name}`;
            sampleSubsubcategories.push({
              categoryName: category.name,
              subName: subcategory.name,
              subsubName: defaultSubsubName
            });
            console.log(`Adding default subsubcategory: ${defaultSubsubName} in subcategory ${subcategory.name}`);
          }
        }
      }
      
      // Create a user for this identity
      const email = `${identityName.toLowerCase().replace(/[^a-z0-9]/g, "-")}@54links.com`;
      
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        console.log(`User ${email} already exists, skipping...`);
        continue;
      }
      
      await upsertUserWithProfile({
        email,
        password: "User@123",
        name: `${identityName} User`,
        phone: "+1234567890",
        nationality: "African",
        country: "South Africa",
        countryOfResidence: "South Africa",
        city: "Johannesburg",
        accountType: "individual",
        profile: {
          primaryIdentity: identityName,
          professionalTitle: `${identityName} Professional`,
          about: `A sample user with ${identityName} identity.`,
          experienceLevel: "Mid",
          skills: ["Sample Skill 1", "Sample Skill 2"],
          languages: [{ name: "English", level: "Advanced" }],
        },
        identities: [identityName],
        categories: sampleCategories,
        subcategories: sampleSubcategories,
        subsubcategories: sampleSubsubcategories,
        categoryInterests: sampleCategories,
        subcategoryInterests: sampleSubcategories,
        subsubcategoryInterests: sampleSubsubcategories,
        identityInterests: [identityName],
        goals: identityCategoryMap.goals.slice(0, 3), // Take first 3 goals
      });
      
      console.log(`Created sample user for identity: ${identityName}`);
    }
    
    console.log("✅ Sample users from identity_category_map.json created successfully.");
  } catch (error) {
    console.error("❌ Failed to seed users from identity_category_map.json:", error);
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (seed).");

    // Em dev, se quiser:
    await sequelize.sync({ alter: true });

    await ensureCategoriesIfEmpty();
    await ensureGoalsIfEmpty();
    await ensureIdentitiesIfEmpty();

    // Ensure subsubcategories exist for each subcategory
    const subcategories = await Subcategory.findAll();
    for (const subcategory of subcategories) {
      const subsubCount = await SubsubCategory.count({ where: { subcategoryId: subcategory.id } });
      if (subsubCount === 0) {
        // Create a default subsubcategory if none exist
        await SubsubCategory.create({
          name: `Default ${subcategory.name}`,
          subcategoryId: subcategory.id
        });
        console.log(`Created default subsubcategory for ${subcategory.name}`);
      }
    }

    for (const u of BULK_USERS) {
      await upsertUserWithProfile(u);
    }
    
    // Seed users from identity_category_map.json
    await seedUsersFromIdentityCategoryMap();

    console.log("✅ Seed completed.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
  }
})();
