const router = require("express").Router();
const C = require("../controllers/product.controller");
const auth = require("../middleware/auth"); // auth(true) -> requires token

// Metadata for form
router.get("/meta", auth(false), C.getMeta);

// CRUD
router.get("/", auth(false), C.list);
router.get("/my", auth(true), C.getMyProducts); // Get products sold by the current user
router.get("/:id", auth(false), C.getOne);
router.post("/", auth(true), C.create);
router.put("/:id", auth(true), C.update);

module.exports = router;