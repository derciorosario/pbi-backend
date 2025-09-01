// src/seeds/seedUsers.js
require("dotenv").config();

const {
  sequelize,
  User,
  Profile,
  Category,
  Subcategory,
  UserCategory,
  UserSubcategory,
} = require("../models");

// ---------- Minimal catalog (only seeded if empty) ----------

const bcrypt = require("bcryptjs");

const CATALOG = [
  {
    name: "Technology",
    subs: ["Software Development", "Artificial Intelligence", "Cybersecurity", "Data Analysis", "Fintech", "Telecom & Connectivity", "Hardware & Devices"],
  },
  {
    name: "Agriculture",
    subs: ["Crop Production", "Livestock & Poultry", "Agro-Processing", "Agro-Tech", "Equipment & Inputs"],
  },
  {
    name: "Commerce & Financial Services",
    subs: ["Banking", "Insurance", "Fintech", "Investment & Capital Markets", "Microfinance & Cooperative Services"],
  },
  {
    name: "Marketing & Advertising",
    subs: [
      "Digital Marketing",
      "Branding & Creative Strategy",
      "Advertising",
      "Public Relations",
      "Market Research & Analytics",
      "Event Marketing & Activations",
      "Influencer & Affiliate Marketing",
      "Email & Direct Marketing",
      "Product Marketing & Go-to-Market",
    ],
  },
  {
    name: "Tourism & Hospitality",
    subs: ["Hotels & Accommodation", "Travel Agencies & Tour Operators", "Eco-Tourism", "Cultural Tourism", "Event Management"],
  },
];

// ---------- Helpers ----------
async function ensureCategoriesIfEmpty() {
  const count = await Category.count();
  if (count > 0) return;

  for (const cat of CATALOG) {
    const category = await Category.create({ name: cat.name });
    for (const s of cat.subs) {
      await Subcategory.create({ name: s, categoryId: category.id });
    }
  }
  console.log(`✅ Seeded ${CATALOG.length} categories (because DB had none).`);
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
    const sub = await Subcategory.findOne({ where: { name: subName, categoryId: cat.id } });
    if (sub) out.push(sub.id);
  }
  return out;
}


async function upsertUserWithProfile({
  email,
  password = "User@123",        // default password if not provided
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
}) {
  // 👇 hash once and store in the correct column
  const passwordHash = await hash(password);

  let user = await User.findOne({ where: { email } });
  if (!user) {
    user = await User.create({
      email,
      passwordHash,              // <-- IMPORTANT: your model expects this
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
    // optional: do NOT re-hash; keep existing hash unless you really want to reset it
    // If you want to force-reset:
    // user.passwordHash = passwordHash;
    await user.save();
    console.log(`ℹ️  User already exists: ${email}`);
  }

  // Ensure profile exists
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
      onboardingCategoriesDone:  categories.length > 0 || subcategories.length > 0,
      onboardingGoalsDone:       false,
    });
    console.log(`🧩 Profile created for: ${email}`);
  } else {
    // Update minimal bits if provided
    Object.assign(prof, {
      primaryIdentity: profile.primaryIdentity ?? prof.primaryIdentity,
      professionalTitle: profile.professionalTitle ?? prof.professionalTitle,
      about: profile.about ?? prof.about,
      avatarUrl: profile.avatarUrl ?? prof.avatarUrl,
      birthDate: profile.birthDate ?? prof.birthDate,
      experienceLevel: profile.experienceLevel ?? prof.experienceLevel,
      skills: Array.isArray(profile.skills) ? profile.skills : prof.skills,
      languages: Array.isArray(profile.languages) ? profile.languages : prof.languages,
    });
    await prof.save();
    console.log(`🛠️  Profile updated for: ${email}`);
  }

  // Attach categories / subcategories (many-to-many)
  if (categories.length || subcategories.length) {
    const catIds = await findCategoryIdsByNames(categories);
    const subIds = await findSubcategoryIdsByNames(subcategories);

    // Clean previous
    await UserCategory.destroy({ where: { userId: user.id } });
    await UserSubcategory.destroy({ where: { userId: user.id } });

    // Insert new
    for (const cid of catIds) await UserCategory.create({ userId: user.id, categoryId: cid });
    for (const sid of subIds) await UserSubcategory.create({ userId: user.id, subcategoryId: sid });

    console.log(`🔗 Linked ${catIds.length} categories & ${subIds.length} subcategories to ${email}`);
  }

  return user;
}

async function hash(pwd = "ChangeMe@123") {
  return bcrypt.hash(pwd, 10);
}


const BULK_USERS = [
  // --- Companies ---
  {
    email: "afri-agro@pbi.africa",
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
    categories: ["Agriculture", "Commerce & Financial Services"],
    subcategories: [
      { categoryName: "Agriculture", subName: "Agro-Processing" },
      { categoryName: "Commerce & Financial Services", subName: "Investment & Capital Markets" },
    ],
  },
  {
    email: "sa-renew@pbi.africa",
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
  },
  {
    email: "naija-fintech@pbi.africa",
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
  },
  {
    email: "kenya-logistics@pbi.africa",
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
  },

  // --- Individuals (Job Seekers, Professionals, etc.) ---
  {
    email: "amara.dev@pbi.africa",
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
    categories: ["Technology"],
    subcategories: [{ categoryName: "Technology", subName: "Software Development" }],
  },
  {
    email: "amina.designer@pbi.africa",
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
  },
  {
    email: "youssef.data@pbi.africa",
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
  },
  {
    email: "chinedu.hr@pbi.africa",
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
  },
  {
    email: "helena.events@pbi.africa",
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
  },

  // --- Admins ---
  {
    email: "ops.admin@pbi.africa",
    password: "Admin@123",
    name: "PBI Ops",
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
  },
  {
    email: "content.admin@pbi.africa",
    password: "Admin@123",
    name: "PBI Content Admin",
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
      { categoryName: "Media & Entertainment", subName: "Publishing (Books, Magazines, Digital Publishing" },
      { categoryName: "Education", subName: "EdTech" },
    ],
  },
];

// ---------- Main ----------
(async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (seed).");

    // Optionally ensure models are up to date in dev:
    // await sequelize.sync({ alter: true });

    await ensureCategoriesIfEmpty();

    // -------- DEMO USERS --------

    // 1) Company user (accountType: company)
    for (const u of BULK_USERS) {
    await upsertUserWithProfile(u);
    }

    console.log("✅ Seed completed.");
   // process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    //process.exit(1);
  }
})();
