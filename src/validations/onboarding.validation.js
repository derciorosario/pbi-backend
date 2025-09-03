const { body } = require("express-validator");

const setProfileType = [
  body("primaryIdentity").isIn([
    "Entrepreneur","Seller","Buyer","Job Seeker","Professional","Partnership",
    "Investor","Event Organizer","Government Official","Traveler","NGO",
    "Support Role","Freelancer","Student"
  ])
];

const setCategories = [
  body("categoryIds").isArray({ min: 1 }),
  body("subcategoryIds").isArray({ min: 1 }), // ≥ 2 subcategories total
];

const setGoals = [
  body("goalIds").isArray().custom(a => a.length > 0 && a.length <= 3),
];

module.exports = { setProfileType, setCategories, setGoals };
