import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOTPEmail(email, name, otp) {
    const mailOptions = {
      from: `"Zomato Clone" <${process.env.MAIL_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: '🔐 Your OTP for Zomato Clone Login',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OTP Verification</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 500px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 16px;
              box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #ff4f5f, #ff7e8b);
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 26px;
              font-weight: 700;
              margin: 0;
              font-family: 'Poppins', sans-serif;
            }
            .header p {
              color: rgba(255, 255, 255, 0.9);
              font-size: 14px;
              margin: 6px 0 0;
            }
            .content {
              padding: 35px 30px;
              text-align: center;
            }
            .content h2 {
              color: #1a1a1a;
              font-size: 20px;
              margin-top: 0;
            }
            .content p {
              color: #555;
              line-height: 1.6;
              font-size: 15px;
            }
            .otp-box {
              background: linear-gradient(135deg, #fff5f6, #fff0f0);
              padding: 20px;
              border-radius: 12px;
              margin: 20px 0;
              border: 2px dashed #ff4f5f;
            }
            .otp-code {
              font-size: 42px;
              font-weight: 800;
              letter-spacing: 8px;
              color: #ff4f5f;
              font-family: 'Courier New', monospace;
            }
            .otp-label {
              display: block;
              font-size: 13px;
              color: #999;
              margin-bottom: 4px;
            }
            .divider {
              border: none;
              border-top: 1px solid #f0f0f0;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              border-top: 1px solid #f0f0f0;
              color: #999;
              font-size: 13px;
            }
            .timer {
              display: inline-block;
              background: #f8f8f8;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 13px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍽️ Zomato Clone</h1>
              <p>One Time Password (OTP)</p>
            </div>
            <div class="content">
              <h2>Hello ${name || 'User'}! 👋</h2>
              <p>Use the following OTP to login to your account.</p>
              
              <div class="otp-box">
                <span class="otp-label">Your OTP Code</span>
                <div class="otp-code">${otp}</div>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                This OTP is valid for <strong>5 minutes</strong>.
              </p>
              <p style="font-size: 13px; color: #999;">
                If you didn't request this code, please ignore this email.
              </p>
              
              <hr class="divider" />
              
              <div class="timer">
                ⏱️ Expires in 5 minutes
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2024 Zomato Clone. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent to:', email);
      console.log('📧 Message ID:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      throw error;
    }
  }
}

export default new EmailService();