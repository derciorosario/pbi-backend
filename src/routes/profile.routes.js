// src/routes/profile.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const C = require("../controllers/profile.controller");

router.get("/profile/me", auth(true), C.getMe);
router.put("/profile/personal", auth(true), C.updatePersonal);
router.put("/profile/professional", auth(true), C.updateProfessional);


router.put("/profile/do-selections", auth(true), C.updateDoSelections);
router.put("/profile/interest-selections", auth(true), C.updateInterestSelections);

module.exports = router;


