import express from "express";
import pool from "../db/pool.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {

        const [rows] = await pool.query(
            "SELECT * FROM users"
        );

        res.json(rows);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: err.message
        });

    }
});

export default router;