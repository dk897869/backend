import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool, query } from '../db/pool.js';
import emailService from '../services/email.service.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================
// Ensure Tables Exist
// ============================================

const ensureTablesExist = async () => {
  try {
    // Check if users table exists
    const [tables] = await query("SHOW TABLES LIKE 'users'");
    
    if (!tables) {
      console.log('📦 Creating users table...');
      await pool.execute(`
        CREATE TABLE users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NULL,
          phone VARCHAR(20) NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          verification_token VARCHAR(255) NULL,
          verification_expires TIMESTAMP NULL,
          reset_token VARCHAR(255) NULL,
          reset_expires TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_verification_token (verification_token),
          INDEX idx_reset_token (reset_token)
        )
      `);
      console.log('✅ Users table created');
    } else {
      // Check if password column exists
      const [columns] = await query("SHOW COLUMNS FROM users LIKE 'password'");
      if (!columns) {
        console.log('📦 Adding password column...');
        await pool.execute('ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL');
        console.log('✅ Password column added');
      }
    }

    // Create email_otps table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_email (email)
      )
    `);

    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ Error ensuring tables exist:', err);
  }
};

// Run table initialization
ensureTablesExist();

// ============================================
// SIGNUP ROUTE
// ============================================

/**
 * POST /api/auth/signup
 * Register new user with email verification
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    console.log('📝 Signup Request:', { name, email });

    // Validate input
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid email format.' 
      });
    }

    // Check if user exists
    const [existingUser] = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'Email already registered. Please log in.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert user with all required fields
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, verification_token, verification_expires, is_verified) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email.toLowerCase(), hashedPassword, verificationToken, tokenExpiry, false]
    );

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, name, verificationToken);
      console.log('✅ Verification email sent to:', email);
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful! Please check your email to verify your account.',
      userId: result.insertId,
      emailSent: true,
      devVerificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    });

  } catch (err) {
    console.error('❌ Signup error:', err);
    
    // Handle specific database errors
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({
        success: false,
        error: 'Database schema error. Please ensure all columns exist.',
        details: err.sqlMessage
      });
    }
    
    next(err);
  }
});

// ============================================
// SEND OTP TO EMAIL
// ============================================

/**
 * POST /api/auth/send-otp
 * Send OTP to email for login
 */
router.post('/send-otp', async (req, res, next) => {
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

    await pool.execute(
      `INSERT INTO email_otps (email, otp, expires_at) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE otp = ?, expires_at = ?`,
      [email.toLowerCase(), otp, expiresAt, otp, expiresAt]
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
    next(err);
  }
});

// ============================================
// VERIFY OTP AND LOGIN
// ============================================

/**
 * POST /api/auth/verify-otp
 * Verify OTP and login/create user
 */
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and OTP are required.' 
      });
    }

    const [record] = await query(
      'SELECT * FROM email_otps WHERE email = ? AND otp = ? AND expires_at > NOW()',
      [email.toLowerCase(), otp]
    );

    if (!record) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired OTP.' 
      });
    }

    await pool.execute('DELETE FROM email_otps WHERE email = ?', [email.toLowerCase()]);

    let [user] = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    
    let isNewUser = false;
    
    if (!user) {
      const name = email.split('@')[0];
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, is_verified) VALUES (?, ?, ?)',
        [name, email.toLowerCase(), true]
      );
      [user] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      isNewUser = true;
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.is_verified,
      },
    });

  } catch (err) {
    console.error('❌ Error verifying OTP:', err);
    next(err);
  }
});

// ============================================
// VERIFY EMAIL
// ============================================

/**
 * GET /api/auth/verify-email
 * Verify email with token
 */
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'Verification token is required.' 
      });
    }

    const [user] = await query(
      `SELECT id, email, verification_expires, is_verified 
       FROM users 
       WHERE verification_token = ? AND is_verified = false`,
      [token]
    );

    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired verification token.' 
      });
    }

    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({ 
        success: false,
        error: 'Verification token has expired. Please request a new one.' 
      });
    }

    await pool.execute(
      `UPDATE users 
       SET is_verified = true, verification_token = NULL, verification_expires = NULL 
       WHERE id = ?`,
      [user.id]
    );

    const jwtToken = generateToken(user.id);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token: jwtToken,
      user: { 
        id: user.id, 
        email: user.email,
        name: user.name,
        isVerified: true 
      },
    });

  } catch (err) {
    console.error('❌ Email verification error:', err);
    next(err);
  }
});

// ============================================
// RESEND VERIFICATION
// ============================================

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required.' 
      });
    }

    const [user] = await query(
      `SELECT id, name, email, is_verified 
       FROM users 
       WHERE email = ? AND is_verified = false`,
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or already verified.' 
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.execute(
      `UPDATE users 
       SET verification_token = ?, verification_expires = ? 
       WHERE id = ?`,
      [verificationToken, tokenExpiry, user.id]
    );

    await emailService.sendVerificationEmail(email, user.name, verificationToken);

    res.json({ 
      success: true,
      message: 'Verification email sent successfully.' 
    });

  } catch (err) {
    console.error('❌ Resend verification error:', err);
    next(err);
  }
});

export default router;