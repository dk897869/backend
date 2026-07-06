import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

dotenv.config();

// Use environment variables - NO HARDCODED PASSWORDS!
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

console.log('📊 Connecting to PostgreSQL...');
console.log(`🔗 Host: ${poolConfig.host}`);
console.log(`👤 User: ${poolConfig.user}`);
console.log(`📁 Database: ${poolConfig.database}`);

export const pool = new Pool(poolConfig);

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  console.log('✅ Database connected successfully!');
  release();
});

export const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
};

export default pool;