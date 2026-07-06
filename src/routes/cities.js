import { Router } from "express";
import { query } from "../db/pool.js";

const router = Router();

// GET /api/cities  -> list of cities for the location selector / map
router.get("/", async (req, res, next) => {
  try {
    const { state } = req.query;
    const params = [];
    let where = "";
    if (state) {
      where = "WHERE state = ?";
      params.push(String(state));
    }
    const rows = await query(
      `SELECT id, name, state, latitude, longitude FROM cities ${where} ORDER BY state ASC, name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/states", async (_req, res, next) => {
  try {
    const rows = await query("SELECT DISTINCT state FROM cities ORDER BY state ASC");
    res.json(rows.map((row) => row.state));
  } catch (err) {
    next(err);
  }
});

export default router;
