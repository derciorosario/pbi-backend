
// src/seeds/seedProductsServicesTourismFunding.js
require("dotenv").config();

const {
  sequelize,
  User,
  Category,
  Subcategory,
  Product,
  Service,
  Tourism,
  Funding,
} = require("../models");

/** ------------------------- Helpers ------------------------- **/

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertCategoryByName(name) {
  if (!name) return null;
  let cat = await Category.findOne({ where: { name } });
  if (!cat) {
    cat = await Category.create({ name });
    console.log(`➕ Category created: ${name}`);
  }
  return cat;
}

async function upsertSubcategoryByName(categoryName, subName) {
  if (!categoryName || !subName) return null;
  const cat = await upsertCategoryByName(categoryName);
  let sub = await Subcategory.findOne({
    where: { name: subName, categoryId: cat.id },
  });
  if (!sub) {
    sub = await Subcategory.create({ name: subName, categoryId: cat.id });
    console.log(`   ↳ Subcategory created: ${categoryName} > ${subName}`);
  }
  return sub;
}

async function getUserIdByEmail(email) {
  const u = await User.findOne({ where: { email } });
  if (!u) throw new Error(`User not found for email: ${email}`);
  return u.id;
}

/** ------------------------- Seed Data ------------------------- **/

// Product Seeds
const PRODUCT_SEEDS = [
  {
    title: "Handcrafted Leather Bag",
    description: "Authentic handcrafted leather bag made by local artisans. Perfect for everyday use and special occasions.",
    price: 120.00,
    quantity: 15,
    country: "Kenya",
    tags: ["leather", "handcrafted", "accessories", "fashion"],
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7",
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3"
    ],
    sellerEmail: "kenya-logistics@pbi.africa",
    categoryName: "Fashion & Apparel",
    subcategoryName: "Accessories",
    createdAtDaysAgo: 5,
  },
  {
    title: "African Print Fabric - 6 Yards",
    description: "Vibrant African print fabric, perfect for clothing, home decor, and accessories. 100% cotton, 6 yards.",
    price: 45.00,
    quantity: 50,
    country: "Ghana",
    tags: ["fabric", "african print", "textile", "ankara"],
    images: [
      "https://images.unsplash.com/photo-1534137667199-675a46e143f3",
      "https://images.unsplash.com/photo-1589891685391-c1c1a2c4f1df"
    ],
    sellerEmail: "afri-agro@pbi.africa",
    categoryName: "Fashion & Apparel",
    subcategoryName: "Textiles",
    createdAtDaysAgo: 10,
  },
  {
    title: "Solar Powered Phone Charger",
    description: "Portable solar-powered phone charger with 10,000mAh capacity. Perfect for outdoor activities and areas with limited electricity.",
    price: 65.00,
    quantity: 30,
    country: "South Africa",
    tags: ["solar", "electronics", "sustainable", "charger"],
    images: [
      "https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c",
      "https://images.unsplash.com/photo-1617704548623-340376564e68"
    ],
    sellerEmail: "sa-renew@pbi.africa",
    categoryName: "Technology",
    subcategoryName: "Gadgets & Accessories",
    createdAtDaysAgo: 15,
  },
  {
    title: "Organic Shea Butter - 250g",
    description: "100% pure and organic shea butter sourced from women's cooperatives in Northern Ghana. Great for skin and hair care.",
    price: 18.00,
    quantity: 100,
    country: "Ghana",
    tags: ["organic", "beauty", "skincare", "natural"],
    images: [
      "https://images.unsplash.com/photo-1598662972299-5408ddb8a3dc",
      "https://images.unsplash.com/photo-1571781565036-d3f759be73e4"
    ],
    sellerEmail: "afri-agro@pbi.africa",
    categoryName: "Health & Beauty",
    subcategoryName: "Skincare",
    createdAtDaysAgo: 8,
  },
  {
    title: "Handwoven Basket Set",
    description: "Set of 3 handwoven baskets in different sizes. Made from sustainable materials by skilled artisans.",
    price: 75.00,
    quantity: 20,
    country: "Rwanda",
    tags: ["handwoven", "home decor", "sustainable", "artisan"],
    images: [
      "https://images.unsplash.com/photo-1632164566668-7b0d0c92b10a",
      "https://images.unsplash.com/photo-1611486212557-88be5ff6f941"
    ],
    sellerEmail: "kenya-logistics@pbi.africa",
    categoryName: "Home & Living",
    subcategoryName: "Home Decor",
    createdAtDaysAgo: 12,
  }
];

// Service Seeds
const SERVICE_SEEDS = [
  {
    title: "Web Development & E-commerce Solutions",
    serviceType: "Freelance Work",
    description: "Professional web development services specializing in e-commerce solutions for African businesses. Custom designs, payment integration, and mobile optimization.",
    priceAmount: 500.00,
    priceType: "Fixed Price",
    deliveryTime: "2 Weeks",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "Nigeria",
    city: "Lagos",
    skills: ["React", "Node.js", "E-commerce", "Payment Integration", "UI/UX"],
    attachments: [
      "https://images.unsplash.com/photo-1547658719-da2b51169166",
      "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e"
    ],
    providerEmail: "naija-fintech@pbi.africa",
    categoryName: "Technology",
    subcategoryName: "Web Development",
    createdAtDaysAgo: 3,
  },
  {
    title: "Business Plan Development & Consulting",
    serviceType: "Consulting",
    description: "Comprehensive business plan development and consulting services for startups and SMEs. Market research, financial projections, and strategic planning.",
    priceAmount: 300.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Week",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "South Africa",
    city: "Johannesburg",
    skills: ["Business Planning", "Market Research", "Financial Modeling", "Strategy"],
    attachments: [
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
      "https://images.unsplash.com/photo-1552664730-d307ca884978"
    ],
    providerEmail: "sa-renew@pbi.africa",
    categoryName: "Business",
    subcategoryName: "Consulting & Strategy",
    createdAtDaysAgo: 7,
  },
  {
    title: "Logo & Brand Identity Design",
    serviceType: "Freelance Work",
    description: "Professional logo and brand identity design services. Includes logo, color palette, typography, and brand guidelines.",
    priceAmount: 250.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Week",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "Kenya",
    city: "Nairobi",
    skills: ["Logo Design", "Brand Identity", "Graphic Design", "Adobe Creative Suite"],
    attachments: [
      "https://images.unsplash.com/photo-1626785774573-4b799315345d",
      "https://images.unsplash.com/photo-1634942537034-2531766767d1"
    ],
    providerEmail: "kenya-logistics@pbi.africa",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Branding & Creative Strategy",
    createdAtDaysAgo: 10,
  },
  {
    title: "Agricultural Consulting & Farm Management",
    serviceType: "Consulting",
    description: "Expert agricultural consulting and farm management services. Crop selection, soil analysis, irrigation planning, and yield optimization.",
    priceAmount: 400.00,
    priceType: "Fixed Price",
    deliveryTime: "2 Weeks",
    locationType: "On-site",
    experienceLevel: "Expert",
    country: "Ghana",
    city: "Accra",
    skills: ["Agriculture", "Farm Management", "Crop Planning", "Soil Analysis"],
    attachments: [
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449",
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9"
    ],
    providerEmail: "afri-agro@pbi.africa",
    categoryName: "Agriculture",
    subcategoryName: "Farming & Crop Production",
    createdAtDaysAgo: 5,
  },
  {
    title: "Social Media Marketing & Management",
    serviceType: "Freelance Work",
    description: "Comprehensive social media marketing and management services for African businesses. Content creation, scheduling, and analytics.",
    priceAmount: 200.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Month",
    locationType: "Remote",
    experienceLevel: "Intermediate",
    country: "Nigeria",
    city: "Lagos",
    skills: ["Social Media Marketing", "Content Creation", "Analytics", "Strategy"],
    attachments: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868"
    ],
    providerEmail: "naija-fintech@pbi.africa",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Digital Marketing",
    createdAtDaysAgo: 8,
  }
];

// Tourism Seeds
const TOURISM_SEEDS = [
  {
    postType: "Destination",
    title: "Serengeti National Park Safari Experience",
    description: "Experience the breathtaking wildlife and landscapes of Serengeti National Park. Home to the Great Migration and the Big Five, this is a must-visit destination for nature lovers.",
    country: "Tanzania",
    location: "Serengeti National Park",
    season: "June to October",
    budgetRange: "$1,500 - $3,000",
    tags: ["safari", "wildlife", "nature", "adventure"],
    images: [
      "https://images.unsplash.com/photo-1516426122078-c23e76319801",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e",
      "https://images.unsplash.com/photo-1535941339077-2dd1c7963098"
    ],
    authorEmail: "kenya-logistics@pbi.africa",
    categoryName: "Tourism & Travel",
    subcategoryName: "Wildlife & Safari",
    createdAtDaysAgo: 4,
  },
  {
    postType: "Experience",
    title: "Cape Winelands Tour - South Africa's Premier Wine Region",
    description: "Discover South Africa's world-renowned wine region with this guided tour of the Cape Winelands. Visit top wineries, enjoy wine tastings, and experience the beautiful landscapes.",
    country: "South Africa",
    location: "Stellenbosch, Franschhoek, Paarl",
    season: "Year-round (best September to April)",
    budgetRange: "$100 - $300",
    tags: ["wine", "food", "culture", "scenic"],
    images: [
      "https://images.unsplash.com/photo-1566903451935-7e8835131e97",
      "https://images.unsplash.com/photo-1504279577054-acfeccf8fc52",
      "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb"
    ],
    authorEmail: "sa-renew@pbi.africa",
    categoryName: "Tourism & Travel",
    subcategoryName: "Food & Wine",
    createdAtDaysAgo: 7,
  },
  {
    postType: "Culture",
    title: "Maasai Cultural Experience - Traditional Village Visit",
    description: "Immerse yourself in the rich culture of the Maasai people with a visit to a traditional village. Learn about their customs, traditions, and way of life directly from community members.",
    country: "Kenya",
    location: "Maasai Mara Region",
    season: "Year-round",
    budgetRange: "$50 - $150",
    tags: ["culture", "indigenous", "tradition", "community"],
    images: [
      "https://images.unsplash.com/photo-1489493585363-d69421e0edd3",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5",
      "https://images.unsplash.com/photo-1523805009345-7448845a9e53"
    ],
    authorEmail: "kenya-logistics@pbi.africa",
    categoryName: "Tourism & Travel",
    subcategoryName: "Cultural Tourism",
    createdAtDaysAgo: 10,
  },
  {
    postType: "Destination",
    title: "Victoria Falls - The Smoke That Thunders",
    description: "Experience the majestic Victoria Falls, one of the Seven Natural Wonders of the World. Enjoy breathtaking views, adventure activities, and the rich biodiversity of the surrounding area.",
    country: "Zimbabwe/Zambia",
    location: "Victoria Falls",
    season: "February to May (highest flow)",
    budgetRange: "$500 - $1,000",
    tags: ["waterfall", "adventure", "nature", "UNESCO"],
    images: [
      "https://images.unsplash.com/photo-1609198092458-38a293c7ac4b",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5",
      "https://images.unsplash.com/photo-1565622871630-8e818e5bd4a6"
    ],
    authorEmail: "sa-renew@pbi.africa",
    categoryName: "Tourism & Travel",
    subcategoryName: "Natural Wonders",
    createdAtDaysAgo: 15,
  },
  {
    postType: "Experience",
    title: "Atlas Mountains Trekking Adventure",
    description: "Embark on an unforgettable trekking adventure in Morocco's Atlas Mountains. Experience breathtaking landscapes, traditional Berber villages, and the highest peak in North Africa.",
    country: "Morocco",
    location: "Atlas Mountains",
    season: "April to October",
    budgetRange: "$300 - $800",
    tags: ["trekking", "mountains", "adventure", "culture"],
    images: [
      "https://images.unsplash.com/photo-1528834342297-fdefb9a5a92b",
      "https://images.unsplash.com/photo-1518005068251-37900150dfca",
      "https://images.unsplash.com/photo-1504609813442-a8924e83f76e"
    ],
    authorEmail: "naija-fintech@pbi.africa",
    categoryName: "Tourism & Travel",
    subcategoryName: "Adventure Tourism",
    createdAtDaysAgo: 9,
  }
];

// Funding Seeds
const FUNDING_SEEDS = [
  {
    title: "Sustainable Agriculture Technology for Small-Scale Farmers",
    pitch: "We're developing affordable, solar-powered irrigation systems for small-scale farmers across East Africa. Our technology increases crop yields by 40% while reducing water usage by 60%.",
    goal: 50000.00,
    raised: 15000.00,
    currency: "USD",
    deadline: daysAgo(-60), // 60 days in the future
    country: "Kenya",
    city: "Nairobi",
    rewards: "Backers will receive regular impact reports, recognition on our website, and early access to our technology depending on contribution level.",
    team: "Our team consists of agricultural engineers, solar energy experts, and rural development specialists with over 20 years of combined experience.",
    email: "contact@agritech.co.ke",
    phone: "+254712345678",
    status: "published",
    visibility: "public",
    tags: ["agriculture", "solar", "irrigation", "sustainability"],
    links: ["https://agritech.co.ke", "https://twitter.com/agritech"],
    images: [
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9",
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449",
      "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8"
    ],
    creatorEmail: "afri-agro@pbi.africa",
    categoryName: "Agriculture",
    createdAtDaysAgo: 5,
  },
  {
    title: "Mobile Health Clinic for Rural Communities",
    pitch: "We're launching a fleet of mobile health clinics to provide essential healthcare services to underserved rural communities in Nigeria. Each clinic can serve up to 500 patients per week.",
    goal: 75000.00,
    raised: 25000.00,
    currency: "USD",
    deadline: daysAgo(-90), // 90 days in the future
    country: "Nigeria",
    city: "Lagos",
    rewards: "Backers will receive impact reports, recognition on our clinic vehicles, and invitations to our launch events based on contribution level.",
    team: "Our team includes medical professionals, public health experts, and logistics specialists committed to improving healthcare access.",
    email: "info@mobilehealth.ng",
    phone: "+2349012345678",
    status: "published",
    visibility: "public",
    tags: ["healthcare", "mobile clinic", "rural", "community"],
    links: ["https://mobilehealth.ng", "https://instagram.com/mobilehealth"],
    images: [
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c",
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef",
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118"
    ],
    creatorEmail: "naija-fintech@pbi.africa",
    categoryName: "Healthcare",
    createdAtDaysAgo: 10,
  },
  {
    title: "Renewable Energy Microgrids for Off-Grid Communities",
    pitch: "We're building solar-powered microgrids to provide clean, reliable electricity to off-grid communities in South Africa. Our solution is 30% more affordable than traditional grid extensions.",
    goal: 100000.00,
    raised: 40000.00,
    currency: "USD",
    deadline: daysAgo(-120), // 120 days in the future
    country: "South Africa",
    city: "Cape Town",
    rewards: "Backers will receive regular project updates, recognition on our installations, and community impact reports based on contribution level.",
    team: "Our team consists of renewable energy engineers, community development specialists, and financial experts with extensive experience in off-grid solutions.",
    email: "projects@cleanenergy.co.za",
    phone: "+27821234567",
    status: "published",
    visibility: "public",
    tags: ["renewable energy", "solar", "microgrid", "off-grid"],
    links: ["https://cleanenergy.co.za", "https://linkedin.com/company/cleanenergy"],
    images: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276",
      "https://images.unsplash.com/photo-1497440001374-f26997328c1b",
      "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e"
    ],
    creatorEmail: "sa-renew@pbi.africa",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    createdAtDaysAgo: 15,
  },
  {
    title: "Educational Technology for Rural Schools",
    pitch: "We're developing low-cost, solar-powered tablets preloaded with educational content for students in rural schools across Ghana. Our solution works offline and includes teacher training.",
    goal: 60000.00,
    raised: 20000.00,
    currency: "USD",
    deadline: daysAgo(-75), // 75 days in the future
    country: "Ghana",
    city: "Accra",
    rewards: "Backers will receive impact reports, recognition in our materials, and opportunities to connect with beneficiary schools based on contribution level.",
    team: "Our team includes educators, software developers, and education policy experts committed to improving access to quality education.",
    email: "info@edutechghana.org",
    phone: "+233201234567",
    status: "published",
    visibility: "public",
    tags: ["education", "technology", "rural", "tablets"],
    links: ["https://edutechghana.org", "https://facebook.com/edutechghana"],
    images: [
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
      "https://images.unsplash.com/photo-1588072432836-e10032774350",
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6"
    ],
    creatorEmail: "afri-agro@pbi.africa",
    categoryName: "Education",
    createdAtDaysAgo: 8,
  },
  {
    title: "Sustainable Fashion Brand Using African Textiles",
    pitch: "We're launching a sustainable fashion brand that combines traditional African textiles with modern designs. Our products are ethically produced by local artisans, supporting fair wages and cultural preservation.",
    goal: 40000.00,
    raised: 15000.00,
    currency: "USD",
    deadline: daysAgo(-45), // 45 days in the future
    country: "Kenya",
    city: "Nairobi",
    rewards: "Backers will receive limited edition products, behind-the-scenes access, and recognition on our website based on contribution level.",
    team: "Our team includes fashion designers, textile experts, and business professionals with a passion for sustainable fashion and African heritage.",
    email: "hello@afrifashion.co.ke",
    phone: "+254712345678",
    status: "published",
    visibility: "public",
    tags: ["fashion", "sustainable", "textiles", "artisan"],
    links: ["https://afrifashion.co.ke", "https://instagram.com/afrifashion"],
    images: [
      "https://images.unsplash.com/photo-1534137667199-675a46e143f3",
      "https://images.unsplash.com/photo-1589891685391-c1c1a2c4f1df",
      "https://images.unsplash.com/photo-1509319117193-57bab727e09d"
    ],
    creatorEmail: "kenya-logistics@pbi.africa",
    categoryName: "Fashion & Apparel",
    createdAtDaysAgo: 12,
  }
];

/** ------------------------- Main ------------------------- **/


async function run(){
     try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (seed products/services/tourism/funding).");

    // --- Seed Products ---
    const productCount = await Product.count();
    
    for (const p of PRODUCT_SEEDS) {
      if (productCount > 0) {
        console.log(`👥 Products already exist (${productCount}), skipping product seed.`);
        break;
      }
      
      const sellerUserId = await getUserIdByEmail(p.sellerEmail);
      const cat = await upsertCategoryByName(p.categoryName);
      const sub = p.subcategoryName
        ? await upsertSubcategoryByName(p.categoryName, p.subcategoryName)
        : null;

      // Avoid duplicates by (title + sellerUserId)
      const [row, created] = await Product.findOrCreate({
        where: {
          title: p.title,
          sellerUserId: sellerUserId,
        },
        defaults: {
          description: p.description,
          price: p.price || null,
          quantity: p.quantity || null,
          country: p.country || null,
          tags: p.tags || [],
          images: p.images || [],
          sellerUserId,
          createdAt: daysAgo(p.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Product: ${p.title}`);
    }

    // --- Seed Services ---
    const serviceCount = await Service.count();
    
    for (const s of SERVICE_SEEDS) {
      if (serviceCount > 0) {
        console.log(`👥 Services already exist (${serviceCount}), skipping service seed.`);
        break;
      }
      
      const providerUserId = await getUserIdByEmail(s.providerEmail);
      const cat = await upsertCategoryByName(s.categoryName);
      const sub = s.subcategoryName
        ? await upsertSubcategoryByName(s.categoryName, s.subcategoryName)
        : null;

      // Avoid duplicates by (title + providerUserId)
      const [row, created] = await Service.findOrCreate({
        where: {
          title: s.title,
          providerUserId: providerUserId,
        },
        defaults: {
          serviceType: s.serviceType,
          description: s.description,
          priceAmount: s.priceAmount || null,
          priceType: s.priceType,
          deliveryTime: s.deliveryTime,
          locationType: s.locationType,
          experienceLevel: s.experienceLevel,
          country: s.country || null,
          city: s.city || null,
          skills: s.skills || [],
          attachments: s.attachments || [],
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          createdAt: daysAgo(s.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Service: ${s.title}`);
    }

    // --- Seed Tourism ---
    const tourismCount = await Tourism.count();
    
    for (const t of TOURISM_SEEDS) {
      if (tourismCount > 0) {
        console.log(`👥 Tourism posts already exist (${tourismCount}), skipping tourism seed.`);
        break;
      }
      
      const authorUserId = await getUserIdByEmail(t.authorEmail);
      const cat = await upsertCategoryByName(t.categoryName);
      const sub = t.subcategoryName
        ? await upsertSubcategoryByName(t.categoryName, t.subcategoryName)
        : null;

      // Avoid duplicates by (title + authorUserId)
      const [row, created] = await Tourism.findOrCreate({
        where: {
          title: t.title,
          authorUserId: authorUserId,
        },
        defaults: {
          postType: t.postType,
          description: t.description,
          country: t.country,
          location: t.location || null,
          season: t.season || null,
          budgetRange: t.budgetRange || null,
          tags: t.tags || [],
          images: t.images || [],
          createdAt: daysAgo(t.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Tourism: ${t.title}`);
    }

    // --- Seed Funding ---
    const fundingCount = await Funding.count();
    
    for (const f of FUNDING_SEEDS) {
      if (fundingCount > 0) {
        console.log(`👥 Funding projects already exist (${fundingCount}), skipping funding seed.`);
        break;
      }
      
      const creatorUserId = await getUserIdByEmail(f.creatorEmail);
      const cat = await upsertCategoryByName(f.categoryName);
      const sub = f.subcategoryName
        ? await upsertSubcategoryByName(f.categoryName, f.subcategoryName)
        : null;

      // Avoid duplicates by (title + creatorUserId)
      const [row, created] = await Funding.findOrCreate({
        where: {
          title: f.title,
          creatorUserId: creatorUserId,
        },
        defaults: {
          pitch: f.pitch,
          goal: f.goal,
          raised: f.raised || 0,
          currency: f.currency,
          deadline: f.deadline,
          country: f.country,
          city: f.city || null,
          rewards: f.rewards || null,
          team: f.team || null,
          email: f.email || null,
          phone: f.phone || null,
          status: f.status || 'published',
          visibility: f.visibility || 'public',
          tags: f.tags || [],
          links: f.links || [],
          images: f.images || [],
          categoryId: cat ? cat.id : null,
          createdAt: daysAgo(f.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Funding: ${f.title}`);
    }

    console.log("🎉 Products, Services, Tourism, and Funding seeding done.");
    // process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
}
}
run()
