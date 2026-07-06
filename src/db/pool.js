import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "zomato_clone",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    // Log but don't throw for table not found errors
    if (error.code === "ER_NO_SUCH_TABLE") {
      console.warn("⚠️ Table not found:", error.sqlMessage);
      return [];
    }
    if (error.code === "ER_BAD_FIELD_ERROR") {
      console.warn("⚠️ Column not found:", error.sqlMessage);
      return [];
    }
    throw error;
  }
};

export default pool;