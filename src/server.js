// src/server.js

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth");
const vendorRoutes = require("./routes/vendors");
const eventRoutes = require("./routes/events");
const documentRoutes = require("./routes/documents");
const errorHandler = require("./middleware/errorHandler");
const { pool } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Auto-migrate + seed on startup ────────────────────────────
async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log("Checking database...");

    // Run schema (CREATE TABLE IF NOT EXISTS — safe to run every time)
    const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await client.query(schema);
    console.log("Schema ready.");

    // Check if already seeded
    const { rows } = await client.query("SELECT COUNT(*) AS count FROM users");
    if (parseInt(rows[0].count) === 0) {
      console.log("Seeding demo data...");
      const bcrypt = require("bcryptjs");
      const { v4: uuid } = require("uuid");

      const hash = await bcrypt.hash("password123", 10);
      const adminId = uuid();
      await client.query(
        `INSERT INTO users (id, name, email, password, role)
         VALUES ($1, 'Admin User', 'admin@vendoros.com', $2, 'admin')
         ON CONFLICT (email) DO NOTHING`,
        [adminId, hash],
      );

      const { rows: cats } = await client.query(
        "SELECT id, name FROM categories",
      );
      const catMap = Object.fromEntries(cats.map((c) => [c.name, c.id]));

      const vendors = [
        {
          name: "Summit AV Productions",
          cat: "Audio/Visual",
          email: "contact@summitav.com",
          phone: "+1 555-0101",
          status: "active",
          notes: "Preferred AV partner.",
        },
        {
          name: "Bloom & Wild Florals",
          cat: "Florals",
          email: "hello@bloomwild.co",
          phone: "+1 555-0202",
          status: "active",
          notes: "Premium florals.",
        },
        {
          name: "Metro Catering Co.",
          cat: "Catering",
          email: "orders@metrocatering.com",
          phone: "+1 555-0303",
          status: "pending",
          notes: "Awaiting cert renewal.",
        },
        {
          name: "Lense & Light Studio",
          cat: "Photography",
          email: "shoot@lenselight.io",
          phone: "+1 555-0404",
          status: "completed",
          notes: "Contract closed.",
        },
        {
          name: "SoundWave Entertainment",
          cat: "Entertainment",
          email: "book@soundwave.com",
          phone: "+1 555-0505",
          status: "active",
          notes: "DJ and live band agency.",
        },
        {
          name: "EliteTransport Group",
          cat: "Transportation",
          email: "fleet@elitetransport.net",
          phone: "+1 555-0606",
          status: "pending",
          notes: "Negotiating rates.",
        },
      ];
      const vendorIds = [];
      for (const v of vendors) {
        const id = uuid();
        vendorIds.push(id);
        await client.query(
          `INSERT INTO vendors (id, name, category_id, email, phone, status, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (email) DO NOTHING`,
          [
            id,
            v.name,
            catMap[v.cat],
            v.email,
            v.phone,
            v.status,
            v.notes,
            adminId,
          ],
        );
      }

      const events = [
        {
          name: "Annual Gala 2025",
          date: "2025-03-15",
          location: "Grand Ballroom",
        },
        {
          name: "Tech Summit Q1",
          date: "2025-02-08",
          location: "Convention Center",
        },
        {
          name: "Product Launch Night",
          date: "2025-04-22",
          location: "Rooftop Venue",
        },
      ];
      const eventIds = [];
      for (const e of events) {
        const id = uuid();
        eventIds.push(id);
        await client.query(
          `INSERT INTO events (id, name, event_date, location, created_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, e.name, e.date, e.location, adminId],
        );
      }

      const assignments = [
        [vendorIds[0], eventIds[0]],
        [vendorIds[1], eventIds[0]],
        [vendorIds[3], eventIds[0]],
        [vendorIds[0], eventIds[1]],
        [vendorIds[2], eventIds[1]],
        [vendorIds[2], eventIds[2]],
        [vendorIds[4], eventIds[2]],
      ];
      for (const [vid, eid] of assignments) {
        await client.query(
          "INSERT INTO vendor_events (vendor_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [vid, eid],
        );
      }
      console.log("Demo data seeded. Login: admin@vendoros.com / password123");
    } else {
      console.log("Database already has data - skipping seed.");
    }
  } catch (err) {
    console.error("Database init error:", err.message);
  } finally {
    client.release();
  }
}

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:3000,https://vm-o814811rbdygiycne2z131.vusercontent.net,https://vendorapi-production.up.railway.app"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*")
      ) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
  }),
);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Static uploads ────────────────────────────────────────────
app.use(
  "/uploads",
  express.static(path.resolve(process.env.UPLOAD_DIR || "uploads")),
);

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/documents", documentRoutes);

// ── Health check ──────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Route not found." }));

// ── Central error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start server then init DB ─────────────────────────────────
app.listen(PORT, async () => {
  console.log(
    `VendorOS API running on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
  );
  await initDatabase();
});

module.exports = app;
