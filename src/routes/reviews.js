import { Router } from "express";
import { pool, query } from "../db/pool.js";

const router = Router();

/**
 * GET /api/reviews?restaurantId=1  -> reviews for a restaurant
 */
router.get("/", async (req, res, next) => {
  try {
    const { restaurantId } = req.query;
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }
    
    // Check if reviews table exists
    try {
      await query("SELECT 1 FROM reviews LIMIT 1");
    } catch (err) {
      return res.status(503).json({ error: "Reviews system is not set up yet." });
    }

    const rows = await query(
      "SELECT id, restaurant_id, customer_name, rating, comment, created_at FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC",
      [Number(restaurantId)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews  -> submit feedback for a restaurant
 * Body: { restaurantId, customerName, rating, comment }
 * Recomputes the restaurant's average rating after insert.
 */
router.post("/", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { restaurantId, customerName, rating, comment } = req.body || {};

    if (!restaurantId || !customerName || !rating) {
      return res.status(400).json({ error: "restaurantId, customerName and rating are required." });
    }
    const numericRating = Number(rating);
    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    // Check if reviews table exists
    try {
      await query("SELECT 1 FROM reviews LIMIT 1");
    } catch (err) {
      return res.status(503).json({ error: "Reviews system is not set up yet." });
    }

    await conn.beginTransaction();

    const [insertRes] = await conn.execute(
      "INSERT INTO reviews (restaurant_id, customer_name, rating, comment) VALUES (?, ?, ?, ?)",
      [Number(restaurantId), customerName, numericRating, comment || null]
    );

    // Update the restaurant's average rating.
    const [[agg]] = await conn.query(
      "SELECT ROUND(AVG(rating), 1) AS avg_rating FROM reviews WHERE restaurant_id = ?",
      [Number(restaurantId)]
    );
    await conn.execute("UPDATE restaurants SET rating = ? WHERE id = ?", [
      agg.avg_rating || numericRating,
      Number(restaurantId),
    ]);

    await conn.commit();

    res.status(201).json({
      id: insertRes.insertId,
      restaurantId: Number(restaurantId),
      customerName,
      rating: numericRating,
      comment: comment || null,
      newAverageRating: agg.avg_rating || numericRating,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;