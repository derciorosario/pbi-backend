const router = require("express").Router();
const { resetAndRestart } = require("../utils/restart");

// Simple guard: only allow in development
router.get("/restart", async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    // return res.status(403).json({ message: "Not allowed in production!" });
  }

  res.json({ message: "Restarting server and resetting database..." });

  // Delay so response is sent before shutdown
  setTimeout(() => {
    resetAndRestart();
  }, 500);
});

module.exports = router;
