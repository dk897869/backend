import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool, query } from '../db/pool.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'zomato_clone_secret', { expiresIn: '7d' });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// Ensure Tables Exist (Skip in Production)
// ============================================

const ensureTablesExist = async () => {
  // Skip table creation in production - tables should already exist
  if (process.env.NODE_ENV === 'production') {
    console.log('🚀 Production mode - using existing database tables');
    
    try {
      // Simple connection test using query helper
      const result = await query('SELECT NOW() as time');
      console.log('✅ Database connection verified:', result[0].time);
      return;
    } catch (err) {
      console.error('❌ Database connection test failed:', err.message);
      
      // Try direct pool connection as fallback
      try {
        const client = await pool.connect();
        console.log('✅ Database connection verified via direct pool!');
        client.release();
        return;
      } catch (fallbackErr) {
        console.error('❌ Fallback connection also failed:', fallbackErr.message);
        // Don't throw - let the app continue
        console.log('⚠️ Continuing despite connection issues...');
        return;
      }
    }
  }

  // Development only - create tables
  console.log('📦 Development mode - ensuring tables exist...');
  try {
    // Check if users table exists
    const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tableNames = tables.map(t => t.table_name);
    
    if (!tableNames.includes('users')) {
      console.log('📦 Creating users table...');
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NULL,
          phone VARCHAR(20) NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255) NULL,
          verification_expires TIMESTAMP NULL,
          reset_token VARCHAR(255) NULL,
          reset_expires TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Users table created');
    } else {
      console.log('✅ Users table already exists');
    }

    // Create email_otps table if it doesn't exist
    if (!tableNames.includes('email_otps')) {
      console.log('📦 Creating email_otps table...');
      await pool.query(`
        CREATE TABLE email_otps (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          otp VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(email)
        )
      `);
      console.log('✅ Email OTPs table created');
    } else {
      console.log('✅ Email OTPs table already exists');
    }

    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ Error ensuring tables exist:', err.message);
    // Don't throw - let the app continue
    console.log('⚠️ Continuing despite table creation issues...');
  }
};

// Run table initialization
ensureTablesExist();

// ============================================
// SIGNUP ROUTE
// ============================================

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log('📝 Signup Request:', { name, email });

    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required.' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters.' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format.' 
      });
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Email already registered. Please log in.' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users (name, full_name, email, password, verification_token, verification_expires, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, name, email.toLowerCase(), hashedPassword, verificationToken, tokenExpiry, false]
    );

    try {
      await emailService.sendVerificationEmail(email, name, verificationToken);
      console.log('✅ Verification email sent to:', email);
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful! Please check your email to verify your account.',
      userId: result.rows[0].id,
      emailSent: true,
      devVerificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    });

  } catch (err) {
    console.error('❌ Signup error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to create account'
    });
  }
});

// ============================================
// SEND OTP TO EMAIL
// ============================================

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required.' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format.' 
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_otps (email, otp, expires_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) 
       DO UPDATE SET otp = $2, expires_at = $3`,
      [email.toLowerCase(), otp, expiresAt]
    );

    const userName = email.split('@')[0];
    await emailService.sendOTPEmail(email, userName, otp);

    console.log(`📧 OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully to your email.',
      email: email,
    });

  } catch (err) {
    console.error('❌ Error sending OTP:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to send OTP'
    });
  }
});

// ============================================
// VERIFY OTP AND LOGIN
// ============================================

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and OTP are required.' 
      });
    }

    const record = await query(
      'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND expires_at > NOW()',
      [email.toLowerCase(), otp]
    );

    if (!record || record.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired OTP.' 
      });
    }

    await pool.query('DELETE FROM email_otps WHERE email = $1', [email.toLowerCase()]);

    let user = await query('SELECT id, name, full_name, email, is_verified FROM users WHERE email = $1', [email.toLowerCase()]);
    
    let isNewUser = false;
    
    if (!user || user.length === 0) {
      const name = email.split('@')[0];
      const result = await pool.query(
        'INSERT INTO users (name, full_name, email, is_verified) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, name, email.toLowerCase(), true]
      );
      user = await query('SELECT id, name, full_name, email, is_verified FROM users WHERE id = $1', [result.rows[0].id]);
      isNewUser = true;
    }

    const token = generateToken(user[0].id);

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: user[0].id,
        name: user[0].name || user[0].full_name,
        email: user[0].email,
        isVerified: user[0].is_verified,
      },
    });

  } catch (err) {
    console.error('❌ Error verifying OTP:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to verify OTP'
    });
  }
});

// ============================================
// VERIFY EMAIL
// ============================================

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'Verification token is required.' 
      });
    }

    const user = await query(
      `SELECT id, name, full_name, email, verification_expires, is_verified 
       FROM users 
       WHERE verification_token = $1 AND is_verified = false`,
      [token]
    );

    if (!user || user.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired verification token.' 
      });
    }

    if (new Date() > new Date(user[0].verification_expires)) {
      return res.status(400).json({ 
        success: false,
        error: 'Verification token has expired. Please request a new one.' 
      });
    }

    await pool.query(
      `UPDATE users 
       SET is_verified = true, verification_token = NULL, verification_expires = NULL 
       WHERE id = $1`,
      [user[0].id]
    );

    const jwtToken = generateToken(user[0].id);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token: jwtToken,
      user: { 
        id: user[0].id, 
        email: user[0].email,
        name: user[0].name || user[0].full_name,
        isVerified: true 
      },
    });

  } catch (err) {
    console.error('❌ Email verification error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to verify email'
    });
  }
});

// ============================================
// RESEND VERIFICATION
// ============================================

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required.' 
      });
    }

    const user = await query(
      `SELECT id, name, full_name, email, is_verified 
       FROM users 
       WHERE email = $1 AND is_verified = false`,
      [email.toLowerCase()]
    );

    if (!user || user.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or already verified.' 
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users 
       SET verification_token = $1, verification_expires = $2 
       WHERE id = $3`,
      [verificationToken, tokenExpiry, user[0].id]
    );

    await emailService.sendVerificationEmail(email, user[0].name || user[0].full_name, verificationToken);

    res.json({ 
      success: true,
      message: 'Verification email sent successfully.' 
    });

  } catch (err) {
    console.error('❌ Resend verification error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to resend verification'
    });
  }
});

export default router;