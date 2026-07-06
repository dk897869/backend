import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import restaurantsRouter from "./routes/restaurants.js";
import citiesRouter from "./routes/cities.js";
import cuisinesRouter from "./routes/cuisines.js";
import ordersRouter from "./routes/orders.js";
import reviewsRouter from "./routes/reviews.js";
import authRouter from "./routes/auth.js";
import collectionsRouter from "./routes/collections.js";
import pool from "./db/pool.js";

dotenv.config();

const app = express();

// CORS Configuration
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:4200")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', req.body);
  }
  next();
});

app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS serverTime");
    res.json({
      success: true,
      message: "🚀 Zomato Clone Backend Running",
      database: "Connected",
      mysqlTime: rows[0].serverTime,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      database: "Disconnected",
      error: err.message,
    });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      database: "connected",
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      database: "disconnected",
      error: err.message,
    });
  }
});

// Register routes
app.use("/api/auth", authRouter);
app.use("/api/restaurants", restaurantsRouter);
app.use("/api/cities", citiesRouter);
app.use("/api/cuisines", cuisinesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/collections", collectionsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error("❌ Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
