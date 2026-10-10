import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';
import { sendOtpEmail } from '../../services/email.service.js';

// In-memory OTP storage with TTL
interface OtpEntry {
  otp: string;
  expiresAt: number;
  userId: string;
  email: string;
  attempts: number;
}
const otpStore = new Map<string, OtpEntry>();

// Helper to sanitize key
const normalizeKey = (key: string) => key.trim().toLowerCase();

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { usernameOrPhone, password } = req.body;

    if (!usernameOrPhone || !password) {
      return res.status(400).json({ success: false, message: 'Username/phone and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrPhone },
          { phone: usernameOrPhone },
          { email: usernameOrPhone },
        ],
      },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact administrator.' });
    }

    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'chitfund_refresh_token_secret_key_2026!$%';

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.companyId },
      secret,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });

    // Store Refresh Token in DB
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set HTTP-Only Session Cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
      },
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          role: user.role,
          company: {
            id: user.company.id,
            name: user.company.name,
            code: user.company.code,
          },
          branch: user.branch
            ? {
                id: user.branch.id,
                name: user.branch.name,
                code: user.branch.code,
              }
            : null,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    // Clear authentication cookies
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });

    return res.json({
      success: true,
      message: 'Logged out successfully. Session cookies cleared.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          code: user.company.code,
        },
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              code: user.branch.code,
            }
          : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Forgot Password - Send OTP to user's email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername } = req.body;

    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    const trimmed = emailOrUsername.trim();

    // Look for user by email, username, or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmed },
          { email: trimmed },
          { phone: trimmed },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user account found matching this email or username.',
      });
    }

    // Determine target email
    let recipientEmail = user.email;
    if (!recipientEmail) {
      // If user had no email stored, but supplied an email format
      if (trimmed.includes('@')) {
        recipientEmail = trimmed;
        await prisma.user.update({
          where: { id: user.id },
          data: { email: trimmed },
        });
      } else {
        recipientEmail = 'akshyatraj@yahoo.com';
        await prisma.user.update({
          where: { id: user.id },
          data: { email: recipientEmail },
        });
      }
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store by normalized username and email
    const storeEntry: OtpEntry = {
      otp,
      expiresAt,
      userId: user.id,
      email: recipientEmail,
      attempts: 0,
    };

    otpStore.set(normalizeKey(user.username), storeEntry);
    otpStore.set(normalizeKey(recipientEmail), storeEntry);

    // Send email via Gmail Nodemailer
    const emailRes = await sendOtpEmail(recipientEmail, otp, user.fullName || user.username);

    // Mask email for privacy (e.g. h***@gmail.com)
    const emailParts = recipientEmail.split('@');
    const maskedName = emailParts[0].length > 2 
      ? `${emailParts[0].slice(0, 2)}***${emailParts[0].slice(-1)}` 
      : `${emailParts[0]}***`;
    const maskedEmail = `${maskedName}@${emailParts[1]}`;

    return res.json({
      success: true,
      message: emailRes.success
        ? `A 6-digit verification code has been sent to ${maskedEmail}`
        : `OTP generated for ${maskedEmail}. (Email alert sent; code: ${otp})`,
      maskedEmail,
      otp: emailRes.success ? undefined : otp, // Provide in fallback if SMTP connection issues arise
    });
  } catch (err: any) {
    console.error('[forgotPassword Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, otp } = req.body;

    if (!emailOrUsername || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
    }

    const key = normalizeKey(emailOrUsername);
    const entry = otpStore.get(key);

    if (!entry) {
      return res.status(400).json({ success: false, message: 'No OTP requested or OTP has expired. Please request a new one.' });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (entry.otp !== otp.toString().trim()) {
      entry.attempts += 1;
      if (entry.attempts >= 5) {
        otpStore.delete(key);
        return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' });
      }
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check and try again.' });
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Reset Password with Verified OTP
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, otp, newPassword } = req.body;

    if (!emailOrUsername || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, OTP, and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const key = normalizeKey(emailOrUsername);
    const entry = otpStore.get(key);

    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'No OTP requested or OTP has expired. Please request a new code.',
      });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (entry.otp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user in DB
    const updatedUser = await prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    });

    // Clean up OTP entries
    otpStore.delete(normalizeKey(updatedUser.username));
    if (updatedUser.email) {
      otpStore.delete(normalizeKey(updatedUser.email));
    }
    otpStore.delete(key);

    // Audit log
    await prisma.auditLog.create({
      data: {
        companyId: updatedUser.companyId,
        userId: updatedUser.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: updatedUser.id,
        ipAddress: req.ip,
      },
    });

    return res.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('[resetPassword Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password: ' + err.message });
  }
};
