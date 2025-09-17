const router = require("express").Router();
const ctrl = require("../controllers/industryCategory.controller");

// GET /api/industry-categories/tree?type=job
router.get("/tree", ctrl.getTree);

module.exports = router;