
const express=require('express')
const router = express.Router();
const C = require("../controllers/user.controller");
const auth = require("../middleware/auth");

// perfil público (auth opcional: não bloqueia visitantes)
router.get("/users/:id/public", auth(false), C.getPublicProfile);

module.exports = router;
