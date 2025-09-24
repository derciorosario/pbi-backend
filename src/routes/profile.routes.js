// src/routes/profile.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const C = require("../controllers/profile.controller");

router.get("/profile/me", auth(true), C.getMe);
router.put("/profile/personal", auth(true), C.updatePersonal);
router.put("/profile/professional", auth(true), C.updateProfessional);


router.put("/profile/do-selections", auth(true), C.updateDoSelections);
router.put("/profile/interest-selections", auth(true), C.updateInterestSelections);
router.put("/profile/industry-selections", auth(true), C.updateIndustrySelections);

// Portfolio routes
router.put("/profile/portfolio", auth(true), C.updatePortfolio);
router.put("/profile/availability", auth(true), C.updateAvailability);
router.put("/profile/avatar", auth(true), C.updateAvatarUrl);
router.get("/profile/work-samples", auth(true), C.getWorkSamples);
router.post("/profile/work-samples", auth(true), C.createWorkSample);
router.put("/profile/work-samples/:id", auth(true), C.updateWorkSample);
router.delete("/profile/work-samples/:id", auth(true), C.deleteWorkSample);

// Company applications and registrations
router.get("/profile/job-applications", auth(true), C.getJobApplicationsForCompany);
router.get("/profile/event-registrations", auth(true), C.getEventRegistrationsForCompany);

module.exports = router;


