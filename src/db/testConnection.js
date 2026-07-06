import pool from "./pool.js";

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log("✅ MySQL Connected Successfully!");

        connection.release();
    } catch (err) {
        console.log("❌ Connection Failed");
        console.error(err);
    }
}

testConnection();