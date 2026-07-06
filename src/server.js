import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, query } from './db/pool.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// Health Check
// ============================================

app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as time, 1 as connected');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      serverTime: result[0]?.time,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// Test Route
// ============================================

app.get('/api/test', (req, res) => {
  res.json({
    message: '🚀 Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// Auth Routes
// ============================================

app.use('/api/auth', authRoutes);

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME || 'defaultdb'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('\n📋 Available Endpoints:');
  console.log(`  GET  /api/health           - Health check`);
  console.log(`  GET  /api/test             - Test server`);
  console.log(`  POST /api/auth/signup      - Create account`);
  console.log(`  POST /api/auth/login       - Login with password`);
  console.log(`  POST /api/auth/send-otp    - Send OTP`);
  console.log(`  POST /api/auth/verify-otp  - Verify OTP`);
  console.log(`  GET  /api/auth/verify-email - Verify email`);
  console.log('='.repeat(60));
});