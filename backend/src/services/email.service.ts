import 'dotenv/config';
import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER || 'akshyatraj@yahoo.com';
const SMTP_PASS = process.env.SMTP_PASS || 'pbdxbsbvobseaxpv';

export const transporter = nodemailer.createTransport({
  service: 'yahoo',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Verify email configuration on startup (non-blocking)
transporter.verify((error) => {
  if (error) {
    console.warn(`[EmailService] Notice: Yahoo SMTP (${SMTP_USER}) status:`, error.message);
  } else {
    console.log(`[EmailService] Nodemailer successfully connected to Yahoo Mail (${SMTP_USER})`);
  }
});

/**
 * Send a 6-digit OTP email for password reset or verification
 */
export async function sendOtpEmail(to: string, otp: string, fullName: string = 'User') {
  const mailOptions = {
    from: `"ChitKart Security" <${SMTP_USER}>`,
    to,
    subject: 'Your Password Reset OTP - ChitKart',
    text: `Hello ${fullName},\n\nYour One-Time Password (OTP) for password reset on ChitKart is: ${otp}\n\nThis OTP is valid for 10 minutes. Please do not share this code with anyone.\n\nRegards,\nChitKart Security Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: #3E5030; padding: 26px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
          .header p { color: #C8FF00; margin: 6px 0 0 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
          .body { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
          .intro { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
          .otp-container { background: #F4F8F0; border: 2px dashed #3E5030; border-radius: 10px; padding: 22px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #2B3A21; margin: 0; font-family: 'Courier New', Courier, monospace; }
          .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
          .notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #92400e; margin: 20px 0; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ChitKart</h1>
            <p>Security Verification Service</p>
          </div>
          <div class="body">
            <div class="greeting">Hello ${fullName},</div>
            <div class="intro">
              We received a request to reset your password for your <strong>ChitKart</strong> account. Use the 6-digit verification code below to complete your request:
            </div>
            <div class="otp-container">
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">Valid for 10 minutes only</div>
            </div>
            <div class="notice">
              <strong>Security Warning:</strong> Never share this OTP with anyone, including ChitKart staff or administrators. Our team will never ask for your verification code.
            </div>
            <div class="intro" style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
              If you did not request this password reset, please ignore this email or contact support.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ChitKart Management Platform. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] ChitKart OTP email sent successfully to ${to} (MessageId: ${result.messageId})`);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[EmailService] Yahoo SMTP error sending to ${to}:`, error.message);
    console.log(`=========================================`);
    console.log(`[EmailService] BACKUP OTP CODE: [ ${otp} ]`);
    console.log(`=========================================`);
    return { success: false, error: error.message };
  }
}

export interface AdminCredentialsEmailParams {
  to: string;
  fullName: string;
  username: string;
  password: string;
  role?: string;
  companyName?: string;
  companyCode?: string;
  loginUrl?: string;
}

/**
 * Automatically send login credentials to newly created Company Admin / Staff Gmail or email
 */
export async function sendAdminCredentialsEmail(params: AdminCredentialsEmailParams) {
  const {
    to,
    fullName,
    username,
    password,
    role = 'Company Administrator',
    companyName = 'ChitKart Platform',
    companyCode,
    loginUrl = process.env.PORTAL_URL || 'http://localhost:8081',
  } = params;

  const displayCompany = companyCode ? `${companyName} (${companyCode})` : companyName;

  const mailOptions = {
    from: `"ChitKart Administration" <${SMTP_USER}>`,
    to,
    subject: `🎯 Your Administrator Credentials - ${displayCompany}`,
    text: `Hello ${fullName},\n\nAn administrator account has been created for you on ChitKart by the Super Administrator.\n\nYour Login Credentials:\nCompany: ${displayCompany}\nRole: ${role}\nUsername: ${username}\nPassword: ${password}\nLogin Portal: ${loginUrl}\n\nPlease keep these credentials secure and change your password upon first login.\n\nRegards,\nChitKart Platform Administration`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px 12px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0A2540 0%, #1E3A8A 100%); padding: 32px 28px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
          .badge { display: inline-block; background: #0284C7; color: #ffffff; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 10px; }
          .body { padding: 32px 28px; }
          .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .intro { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
          .cred-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .cred-title { font-size: 13px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 6px 0; }
          .cred-label { font-size: 13px; font-weight: 600; color: #64748b; }
          .cred-val { font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; }
          .password-highlight { background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 16px; letter-spacing: 1px; font-weight: 800; display: inline-block; border: 1px dashed #0284c7; }
          .username-highlight { background: #f1f5f9; color: #0f172a; padding: 4px 10px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; }
          .btn-container { text-align: center; margin: 30px 0 20px 0; }
          .btn-primary { display: inline-block; background: #0284C7; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(2,132,199,0.35); }
          .notice-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #92400e; line-height: 1.6; margin-top: 20px; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ChitKart</h1>
            <div class="badge">Official Administrator Account</div>
          </div>
          <div class="body">
            <div class="greeting">Hello ${fullName},</div>
            <div class="intro">
              An administrator account has been created for you by the <strong>Super Administrator</strong>. You have been granted access to manage company operations, chit groups, subscriber onboarding, and collections.
            </div>

            <div class="cred-box">
              <div class="cred-title">🛡️ Your Login Credentials</div>
              <div class="cred-row">
                <span class="cred-label">Organization / Company:</span>
                <span class="cred-val">${displayCompany}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Assigned Role:</span>
                <span class="cred-val">${role}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Login Username:</span>
                <span class="username-highlight">${username}</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Temporary Password:</span>
                <span class="password-highlight">${password}</span>
              </div>
            </div>

            <div class="btn-container">
              <a href="${loginUrl}" class="btn-primary" target="_blank">🚀 Log In to ChitKart Portal</a>
            </div>

            <div class="notice-box">
              <strong>🔒 Security Instructions:</strong><br>
              • Please sign in and immediately change your temporary password under your Profile settings.<br>
              • Do not share or forward your login credentials to any unauthorized person.<br>
              • Single-session policy is enforced: simultaneous logins from other devices will automatically log out older sessions.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ChitKart Platform Management. All rights reserved.<br>
            This is an automated administrative notification sent to ${to}.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Admin credentials successfully emailed to ${to} (MessageId: ${result.messageId})`);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[EmailService] Error emailing credentials to ${to}:`, error.message);
    console.log(`=======================================================`);
    console.log(`[EmailService] BACKUP CREDENTIALS FOR ${to}:`);
    console.log(`Username: ${username} | Password: ${password}`);
    console.log(`=======================================================`);
    return { success: false, error: error.message };
  }
}

