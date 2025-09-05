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
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

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

const jobRoutes = require("./src/routes/job.routes");
app.use("/api/jobs", jobRoutes)

app.use("/api/public", require("./src/routes/public.routes"));

app.use("/api/categories", require("./src/routes/category.routes"));

const eventRoutes = require("./src/routes/event.routes");
app.use("/api/events", eventRoutes);

const serviceRoutes = require("./src/routes/service.routes");
app.use("/api/services", serviceRoutes);

const feedRoutes = require("./src/routes/feed.routes");
app.use("/api", feedRoutes);

// index.js or src/app.js
app.use("/api", require("./src/routes/profile.routes"));

const adminRoutes = require("./src/routes/admin.routes");
app.use("/api", adminRoutes);

const peopleRoutes = require("./src/routes/people.routes");
app.use("/api/people", peopleRoutes);

app.use("/api", require("./src/routes/user.routes"));

app.use("/api", require("./src/routes/connection.routes"));


const publicRoutes = require("./src/routes/public.routes");

app.use("/api/public", publicRoutes);



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
const PORT = process.env.PORT || 5000;

const { seedIfEmpty } = require("./src/utils/seed");
const seedAll = require("./src/seeds/seedAll");




(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    // Auto-sync DB tables (use migrations in production)
    // Temporarily disable alter:true to avoid "Too many keys" error
    await sequelize.sync({ alter: false });
    
    // 👉 Run seeding if needed
    //await seedIfEmpty();

    //await seedAll();

    // 🔑 Ensure default admin exists
    await ensureAdmin();

    //require('./scripts/seed.from.singlefile.js')

    app.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
