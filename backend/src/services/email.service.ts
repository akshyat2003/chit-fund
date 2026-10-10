import 'dotenv/config';
import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER || 'harisankarmohanty010@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'pbdxbsbvobseaxpv';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Verify email configuration on startup (non-blocking)
transporter.verify((error) => {
  if (error) {
    console.warn(`[EmailService] Notice: Gmail SMTP (${SMTP_USER}) status:`, error.message);
  } else {
    console.log(`[EmailService] Nodemailer successfully connected to Gmail (${SMTP_USER})`);
  }
});

/**
 * Send a 6-digit OTP email for password reset or verification
 */
export async function sendOtpEmail(to: string, otp: string, fullName: string = 'User') {
  const mailOptions = {
    from: `"Apex Chit Funds Security" <${SMTP_USER}>`,
    to,
    subject: 'Your Password Reset OTP - Apex Chit Fund Management',
    text: `Hello ${fullName},\n\nYour One-Time Password (OTP) for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes. Please do not share this code with anyone.\n\nRegards,\nApex Chit Funds Security Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: #3E5030; padding: 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px; }
          .header p { color: #C8FF00; margin: 4px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; }
          .body { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
          .intro { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
          .otp-container { background: #F4F8F0; border: 2px dashed #3E5030; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2B3A21; margin: 0; font-family: 'Courier New', Courier, monospace; }
          .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px; font-size: 13px; color: #92400e; margin: 20px 0; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Apex Chit Funds</h1>
            <p>Security Verification Service</p>
          </div>
          <div class="body">
            <div class="greeting">Hello ${fullName},</div>
            <div class="intro">
              We received a request to reset your password for your Chit Fund Management account. Use the verification code below to complete the request:
            </div>
            <div class="otp-container">
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">Valid for 10 minutes only</div>
            </div>
            <div class="notice">
              <strong>Security Warning:</strong> Never share this OTP with anyone, including staff or administrators. Our support team will never ask for your verification code.
            </div>
            <div class="intro" style="font-size: 12px; color: #94a3b8;">
              If you did not request this password reset, please ignore this email or contact your administrator immediately.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Apex Chit Funds India Pvt Ltd. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] OTP email sent successfully to ${to} (MessageId: ${result.messageId})`);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[EmailService] Nodemailer error sending to ${to}:`, error.message);
    console.log(`=========================================`);
    console.log(`[EmailService] SECURE OTP BACKUP CODE: [ ${otp} ]`);
    console.log(`=========================================`);
    return { success: false, error: error.message };
  }
}
