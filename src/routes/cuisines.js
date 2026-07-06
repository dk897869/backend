import { Router } from "express";
import { query } from "../db/pool.js";

const router = Router();

// GET /api/cuisines  -> master list of cuisines for the dropdown filter
router.get("/", async (_req, res, next) => {
  try {
    const rows = await query("SELECT id, name FROM cuisines ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
