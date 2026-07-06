import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runs schema.sql to create the database and all tables.
async function main() {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  // Connect WITHOUT selecting a database so the CREATE DATABASE runs.
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log("Running schema.sql ...");
  await connection.query(sql);
  console.log("Database and tables created successfully.");
  await connection.end();
}

main().catch((err) => {
  console.error("Failed to initialise the database:", err);
  process.exit(1);
});
