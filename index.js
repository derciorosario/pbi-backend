require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const { sequelize } = require("./src/models");
const authRoutes = require("./src/routes/auth.routes");
const { ensureAdmin } = require("./src/setup/ensureAdmin");

// ---------------------------
// Express App Setup
// ---------------------------
const app = express();

// 🔒 Security headers
app.use(helmet());

// 🌍 Allow frontend apps to connect
app.use(cors({ origin: true, credentials: true }));

// 📦 Parse JSON bodies
app.use(express.json({ limit: "10mb" }));

// 📝 Logging
app.use(morgan("dev"));

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ⏱️ Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit per IP
});
app.use("/api/auth", limiter, authRoutes);

const onboardingRoutes = require("./src/routes/onboarding.routes");
app.use("/api/onboarding", onboardingRoutes)

app.use("/api/public", require("./src/routes/public.routes"));

const adminRoutes = require("./src/routes/admin.routes");
app.use("/api", adminRoutes);


// ❌ 404 handler
app.use((req, res) => res.status(404).json({ message: "Not found" }));

// ⚠️ Error handler
app.use((err, req, res, next) => {
  console.error(err); // log error
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// ---------------------------
// Start Server + DB
// ---------------------------
const PORT = process.env.PORT || 4000;

const { seedIfEmpty } = require("./src/utils/seed");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Auto-sync DB tables (use migrations in production)
    await sequelize.sync({ alter: true });

    
    // 👉 Run seeding if needed
    await seedIfEmpty();

    // 🔑 Ensure default admin exists
    await ensureAdmin();

    app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
