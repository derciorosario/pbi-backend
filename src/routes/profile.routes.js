// src/routes/profile.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const C = require("../controllers/profile.controller");

router.get("/profile/me", auth(true), C.getMe);
router.put("/profile/personal", auth(true), C.updatePersonal);
router.put("/profile/professional", auth(true), C.updateProfessional);
router.put("/profile/interests", auth(true), C.updateInterests);
router.put("/profile/identity", auth(true), C.updateIdentity);

module.exports = router;
