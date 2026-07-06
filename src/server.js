import app from "./app.js";
import dotenv from "dotenv";
import pool from "./db/pool.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log("✅ MySQL Connected Successfully");
    connection.release();

    // Start Express Server
    app.listen(PORT, () => {
      console.log(`🚀 Zomato Clone API running on http://localhost:${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
    });

  } catch (error) {
    console.error("❌ Database Connection Failed");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();