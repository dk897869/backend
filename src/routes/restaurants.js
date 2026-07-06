import { Router } from "express";
import { query, pool } from "../db/pool.js";

const router = Router();

/**
 * GET /api/restaurants
 * Query params (all optional):
 *   state        - filter by state
 *   cityId       - filter by city id
 *   serviceMode  - delivery | pickup | dine_in
 *   search       - match restaurant name (LIKE)
 *   cuisineIds   - comma separated cuisine ids
 *   priceLevel   - 1 (low), 2 (medium), 3 (high)
 *   sort         - cost_asc | cost_desc | rating_desc | delivery_asc
 */
router.get("/", async (req, res, next) => {
  try {
    const { state, cityId, search, cuisineIds, priceLevel, serviceMode, sort } = req.query;

    const where = [];
    const params = [];

    if (cityId) {
      where.push("r.city_id = ?");
      params.push(Number(cityId));
    }

    if (state) {
      where.push("c.state = ?");
      params.push(String(state));
    }

    if (serviceMode === "delivery") {
      where.push("r.supports_delivery = 1");
    } else if (serviceMode === "pickup") {
      where.push("r.supports_pickup = 1");
    } else if (serviceMode === "dine_in") {
      where.push("r.supports_dine_in = 1");
    }

    if (search) {
      where.push("r.name LIKE ?");
      params.push(`%${search}%`);
    }

    if (priceLevel) {
      where.push("r.price_level = ?");
      params.push(Number(priceLevel));
    }

    // Check if restaurant_cuisines table exists and has data
    let useCuisineJoin = true;
    try {
      await query("SELECT 1 FROM restaurant_cuisines LIMIT 1");
    } catch (err) {
      useCuisineJoin = false;
      console.log("⚠️ restaurant_cuisines table doesn't exist, skipping cuisine joins");
    }

    // Cuisine filter
    let cuisineJoin = "";
    if (cuisineIds && useCuisineJoin) {
      const ids = String(cuisineIds)
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((x) => !Number.isNaN(x));
      if (ids.length) {
        cuisineJoin = `INNER JOIN restaurant_cuisines rc_f ON rc_f.restaurant_id = r.id AND rc_f.cuisine_id IN (${ids.map(() => "?").join(",")})`;
        params.push(...ids);
      }
    }

    let orderBy = "r.is_promoted DESC, r.rating DESC";
    switch (sort) {
      case "cost_asc":
        orderBy = "r.cost_for_two ASC";
        break;
      case "cost_desc":
        orderBy = "r.cost_for_two DESC";
        break;
      case "rating_desc":
        orderBy = "r.rating DESC";
        break;
      case "delivery_asc":
        orderBy = "r.delivery_time_min ASC";
        break;
    }

    // Build the SELECT clause dynamically based on available columns
    let selectColumns = `
      r.id, r.name, r.description, r.image_url, r.address,
      r.latitude, r.longitude, r.price_level,
      c.state AS state_name,
      c.name AS city_name
    `;

    // Check for optional columns
    try {
      const columns = await query("SHOW COLUMNS FROM restaurants");
      const colNames = columns.map(c => c.Field);
      
      if (colNames.includes('cost_for_two')) selectColumns += `, r.cost_for_two`;
      if (colNames.includes('rating')) selectColumns += `, r.rating`;
      if (colNames.includes('delivery_time_min')) selectColumns += `, r.delivery_time_min`;
      if (colNames.includes('supports_delivery')) selectColumns += `, r.supports_delivery`;
      if (colNames.includes('supports_pickup')) selectColumns += `, r.supports_pickup`;
      if (colNames.includes('supports_dine_in')) selectColumns += `, r.supports_dine_in`;
      if (colNames.includes('is_promoted')) selectColumns += `, r.is_promoted`;
    } catch (err) {
      console.log("⚠️ Could not check columns, using default set");
    }

    let sql;
    if (useCuisineJoin) {
      sql = `
        SELECT
          ${selectColumns},
          GROUP_CONCAT(DISTINCT cu.name ORDER BY cu.name SEPARATOR ', ') AS cuisines
        FROM restaurants r
        JOIN cities c ON c.id = r.city_id
        ${cuisineJoin}
        LEFT JOIN restaurant_cuisines rc ON rc.restaurant_id = r.id
        LEFT JOIN cuisines cu ON cu.id = rc.cuisine_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        GROUP BY r.id
        ORDER BY ${orderBy}
      `;
    } else {
      sql = `
        SELECT
          ${selectColumns},
          '' AS cuisines
        FROM restaurants r
        JOIN cities c ON c.id = r.city_id
        ${cuisineJoin}
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY ${orderBy}
      `;
    }

    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/restaurants/:id
 * Returns the restaurant with its menu, cuisines and reviews.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Check if restaurant_cuisines table exists
    let useCuisineJoin = true;
    try {
      await query("SELECT 1 FROM restaurant_cuisines LIMIT 1");
    } catch (err) {
      useCuisineJoin = false;
    }

    // Build the SELECT clause dynamically
    let selectColumns = `
      r.id, r.name, r.description, r.image_url, r.address,
      r.latitude, r.longitude, r.price_level,
      c.state AS state_name,
      c.name AS city_name
    `;

    try {
      const columns = await query("SHOW COLUMNS FROM restaurants");
      const colNames = columns.map(c => c.Field);
      
      if (colNames.includes('cost_for_two')) selectColumns += `, r.cost_for_two`;
      if (colNames.includes('rating')) selectColumns += `, r.rating`;
      if (colNames.includes('delivery_time_min')) selectColumns += `, r.delivery_time_min`;
      if (colNames.includes('supports_delivery')) selectColumns += `, r.supports_delivery`;
      if (colNames.includes('supports_pickup')) selectColumns += `, r.supports_pickup`;
      if (colNames.includes('supports_dine_in')) selectColumns += `, r.supports_dine_in`;
      if (colNames.includes('is_promoted')) selectColumns += `, r.is_promoted`;
    } catch (err) {
      console.log("⚠️ Could not check columns, using default set");
    }

    let restaurant;
    if (useCuisineJoin) {
      [restaurant] = await query(
        `SELECT
           ${selectColumns},
           GROUP_CONCAT(DISTINCT cu.name ORDER BY cu.name SEPARATOR ', ') AS cuisines
         FROM restaurants r
         JOIN cities c ON c.id = r.city_id
         LEFT JOIN restaurant_cuisines rc ON rc.restaurant_id = r.id
         LEFT JOIN cuisines cu ON cu.id = rc.cuisine_id
         WHERE r.id = ?
         GROUP BY r.id`,
        [id]
      );
    } else {
      [restaurant] = await query(
        `SELECT
           ${selectColumns},
           '' AS cuisines
         FROM restaurants r
         JOIN cities c ON c.id = r.city_id
         WHERE r.id = ?`,
        [id]
      );
    }

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const menu = await query(
      "SELECT id, name, description, price, image_url, rating, order_count, is_veg FROM menu_items WHERE restaurant_id = ? ORDER BY rating DESC, order_count DESC, id ASC",
      [id]
    );

    // Check if reviews table exists
    let reviews = [];
    try {
      reviews = await query(
        "SELECT id, customer_name, rating, comment, created_at FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC",
        [id]
      );
    } catch (err) {
      console.log("⚠️ Reviews table doesn't exist yet");
    }

    res.json({ ...restaurant, menu, reviews });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/recommended", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      `SELECT id, name, description, price, image_url, rating, order_count, is_veg
       FROM menu_items
       WHERE restaurant_id = ?
       ORDER BY rating DESC, order_count DESC, price ASC
       LIMIT 12`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;