const router = require("express").Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const rules = require("../validations/onboarding.validation");
const C = require("../controllers/onboarding.controller");

// All require auth
router.get("/state", auth(true), C.state);
router.post("/profile-type", auth(true), validate(rules.setProfileType), C.saveProfileType);
router.post("/categories",   auth(true), validate(rules.setCategories),  C.saveCategories);
router.post("/goals",        auth(true), validate(rules.setGoals),       C.saveGoals);

module.exports = router;
