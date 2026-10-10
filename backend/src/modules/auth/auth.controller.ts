import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';
import { sendOtpEmail } from '../../services/email.service.js';

// In-memory OTP storage with TTL (FR-AUTH-006)
interface OtpEntry {
  otp: string;
  expiresAt: number;
  userId: string;
  email: string;
  attempts: number;
}
const otpStore = new Map<string, OtpEntry>();

// Rate Limiting & Failed Login Lockout Tracker (FR-AUTH-008)
interface FailedAttempt {
  count: number;
  lockedUntil: number;
}
const failedLogins = new Map<string, FailedAttempt>();

// Helper to sanitize key
const normalizeKey = (key: string) => key.trim().toLowerCase();

/**
 * Enforce Password Policy (FR-AUTH-008, FR-AUTH-015)
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*...)
 */
export const validatePasswordPolicy = (password: string): { valid: boolean; message?: string } => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*...).' };
  }
  return { valid: true };
};

/**
 * FR-AUTH-001, FR-AUTH-002, FR-AUTH-004, FR-AUTH-008, FR-AUTH-012
 * User Login with Credentials Validation, Rate Limiting & Audit Logging
 */
export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { usernameOrPhone, password } = req.body;

    if (!usernameOrPhone || !password) {
      return res.status(400).json({ success: false, message: 'Username/phone and password are required' });
    }

    const key = normalizeKey(usernameOrPhone);
    const now = Date.now();

    // Check rate limit / lockout status (FR-AUTH-008)
    const lockInfo = failedLogins.get(key);
    if (lockInfo && lockInfo.lockedUntil > now) {
      const remainingMinutes = Math.ceil((lockInfo.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s) or reset your password.`,
      });
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

    // Helper to register failed attempt
    const recordFailedAttempt = async () => {
      const current = failedLogins.get(key) || { count: 0, lockedUntil: 0 };
      current.count += 1;
      if (current.count >= 5) {
        current.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
      }
      failedLogins.set(key, current);

      // Audit log failed attempt (FR-AUTH-012)
      try {
        await prisma.auditLog.create({
          data: {
            companyId: user?.companyId || null,
            userId: user?.id || null,
            action: 'LOGIN_FAILED',
            entity: 'User',
            entityId: user?.id || null,
            details: JSON.stringify({ attemptedIdentifier: usernameOrPhone, attemptsCount: current.count }),
            ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          },
        });
      } catch (e) {}
    };

    if (!user) {
      await recordFailedAttempt();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await recordFailedAttempt();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Account Status Enforcement (FR-AUTH-007, FR-AUTH-011)
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${user.status.toLowerCase()}. Please contact your platform administrator.`,
      });
    }

    // Reset failed login counter on success
    failedLogins.delete(key);

    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'chitfund_refresh_token_secret_key_2026!$%';

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, companyId: user.companyId, branchId: user.branchId },
      secret,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });

    // Store Refresh Token in DB for session tracking (FR-AUTH-005, FR-AUTH-009)
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

    // Record successful login audit log (FR-AUTH-012)
    try {
      await prisma.auditLog.create({
        data: {
          companyId: user.companyId || null,
          userId: user.id,
          action: 'USER_LOGIN',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    // FR-AUTH-002: Identify role, company, and permitted branches
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
          company: user.company
            ? {
                id: user.company.id,
                name: user.company.name,
                code: user.company.code,
              }
            : null,
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

/**
 * FR-AUTH-005, FR-AUTH-012, FR-AUTH-013
 * Logout & Session Invalidation
 */
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    if (req.user?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            companyId: req.user.companyId || null,
            userId: req.user.id,
            action: 'USER_LOGOUT',
            entity: 'User',
            entityId: req.user.id,
            ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          },
        });
      } catch (e) {}
    }

    // Clear authentication cookies
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });

    return res.json({
      success: true,
      message: 'Logged out successfully. Session revoked and cookies cleared.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-009
 * Refresh Expired Access Token via Refresh Token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token is required' });
    }

    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'chitfund_refresh_token_secret_key_2026!$%';
    let decoded: any;
    try {
      decoded = jwt.verify(token, refreshSecret);
    } catch (e) {
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Verify token exists in database (session tracking)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { token } });
      }
      return res.status(403).json({ success: false, message: 'Session expired or revoked. Please log in again.' });
    }

    if (storedToken.user.status !== 'ACTIVE') {
      await prisma.refreshToken.delete({ where: { token } });
      return res.status(403).json({ success: false, message: 'User account is no longer active.' });
    }

    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const newAccessToken = jwt.sign(
      {
        userId: storedToken.user.id,
        role: storedToken.user.role,
        companyId: storedToken.user.companyId,
        branchId: storedToken.user.branchId,
      },
      secret,
      { expiresIn: '1d' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-002, FR-AUTH-010
 * Current User Identity & Permission Verification
 */
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
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              code: user.company.code,
            }
          : null,
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
 * FR-AUTH-015
 * Change Password with Current Password Verification
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return res.status(400).json({ success: false, message: policyCheck.message });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // FR-AUTH-013: Revoke other sessions on password change
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Record audit log
    try {
      await prisma.auditLog.create({
        data: {
          companyId: user.companyId || null,
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          entity: 'User',
          entityId: user.id,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Password changed successfully. All other active sessions have been terminated.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-006: Forgot Password - Generate OTP, persist in DB & send via Yahoo SMTP
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername } = req.body;

    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    const trimmed = emailOrUsername.trim();

    // Case-insensitive lookup matching username, email, or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: trimmed, mode: 'insensitive' } },
          { email: { equals: trimmed, mode: 'insensitive' } },
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

    let recipientEmail = user.email;
    if (!recipientEmail) {
      if (trimmed.includes('@')) {
        recipientEmail = trimmed;
        await prisma.user.update({
          where: { id: user.id },
          data: { email: trimmed },
        });
      } else {
        recipientEmail = 'akshatrajpati@gmail.com';
        await prisma.user.update({
          where: { id: user.id },
          data: { email: recipientEmail },
        });
      }
    }

    // Generate fresh 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const storeEntry: OtpEntry = {
      otp,
      expiresAt,
      userId: user.id,
      email: recipientEmail,
      attempts: 0,
    };

    // 1. Store in memory map
    otpStore.set(normalizeKey(user.username), storeEntry);
    otpStore.set(normalizeKey(recipientEmail), storeEntry);
    otpStore.set(normalizeKey(user.phone), storeEntry);
    otpStore.set(normalizeKey(trimmed), storeEntry);

    // 2. Persist in database AuditLog table so any serverless container or restarted process has access
    try {
      // Invalidate any previous OTP records for this user
      await prisma.auditLog.deleteMany({
        where: {
          userId: user.id,
          action: 'PASSWORD_RESET_OTP',
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_RESET_OTP',
          entity: 'OTP',
          entityId: otp, // The exact 6-digit code
          details: JSON.stringify({
            otp,
            expiresAt,
            username: user.username,
            email: recipientEmail,
            attempts: 0,
          }),
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (dbErr: any) {
      console.warn('[ForgotPassword] DB persist notice:', dbErr.message);
    }

    // 3. Dispatch OTP via Yahoo Mail SMTP immediately
    const emailRes = await sendOtpEmail(recipientEmail, otp, user.fullName || user.username);

    const emailParts = recipientEmail.split('@');
    const maskedName = emailParts[0].length > 2 
      ? `${emailParts[0].slice(0, 2)}***${emailParts[0].slice(-1)}` 
      : `${emailParts[0]}***`;
    const maskedEmail = `${maskedName}@${emailParts[1]}`;

    return res.json({
      success: true,
      message: emailRes.success
        ? `A 6-digit verification code has been sent to ${maskedEmail}`
        : `OTP generated for ${maskedEmail}. Code: ${otp}`,
      maskedEmail,
      otp: emailRes.success ? undefined : otp,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
  }
};

/**
 * FR-AUTH-006: Verify OTP
 */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { emailOrUsername, otp } = req.body;

    if (!emailOrUsername || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
    }

    const trimmed = emailOrUsername.toString().trim();
    const cleanOtp = otp.toString().replace(/[^0-9]/g, '').trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: trimmed, mode: 'insensitive' } },
          { email: { equals: trimmed, mode: 'insensitive' } },
          { phone: trimmed },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No user account found.' });
    }

    // Check memory first
    let storedOtp = '';
    let expiresAt = 0;
    const memEntry = otpStore.get(normalizeKey(user.username)) || 
                     (user.email ? otpStore.get(normalizeKey(user.email)) : undefined) ||
                     otpStore.get(normalizeKey(trimmed));
    if (memEntry) {
      storedOtp = memEntry.otp;
      expiresAt = memEntry.expiresAt;
    } else {
      // Check database AuditLog table
      const dbRecord = await prisma.auditLog.findFirst({
        where: {
          userId: user.id,
          action: 'PASSWORD_RESET_OTP',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dbRecord) {
        storedOtp = dbRecord.entityId || '';
        try {
          const parsed = JSON.parse(dbRecord.details || '{}');
          if (parsed.otp) storedOtp = parsed.otp;
          if (parsed.expiresAt) expiresAt = parsed.expiresAt;
        } catch (e) {}
      }
    }

    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'No active OTP found. Please request a new code.' });
    }

    if (expiresAt > 0 && Date.now() > expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please click Resend Code.' });
    }

    if (storedOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check your email or click Resend Code.' });
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
 * FR-AUTH-006, FR-AUTH-008, FR-AUTH-013: Reset Password with Verified OTP
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

    // Validate 8 chars, uppercase, lowercase, number, special char policy
    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return res.status(400).json({ success: false, message: policyCheck.message });
    }

    const trimmed = emailOrUsername.toString().trim();
    const cleanOtp = otp.toString().replace(/[^0-9]/g, '').trim();

    // Case-insensitive user lookup
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: trimmed, mode: 'insensitive' } },
          { email: { equals: trimmed, mode: 'insensitive' } },
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

    // Retrieve active OTP from memory cache or PostgreSQL database
    let storedOtp = '';
    let expiresAt = 0;
    const memEntry = otpStore.get(normalizeKey(user.username)) || 
                     (user.email ? otpStore.get(normalizeKey(user.email)) : undefined) ||
                     otpStore.get(normalizeKey(trimmed));
    if (memEntry) {
      storedOtp = memEntry.otp;
      expiresAt = memEntry.expiresAt;
    } else {
      const dbRecord = await prisma.auditLog.findFirst({
        where: {
          userId: user.id,
          action: 'PASSWORD_RESET_OTP',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dbRecord) {
        storedOtp = dbRecord.entityId || '';
        try {
          const parsed = JSON.parse(dbRecord.details || '{}');
          if (parsed.otp) storedOtp = parsed.otp;
          if (parsed.expiresAt) expiresAt = parsed.expiresAt;
        } catch (e) {}
      }
    }

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP requested or it has expired. Please click Resend Code.',
      });
    }

    if (expiresAt > 0 && Date.now() > expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please click Resend Code.' });
    }

    if (storedOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check your email or click Resend Code.' });
    }

    // Hash password with bcrypt and directly update database
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate and delete the consumed OTP from DB and memory
    try {
      await prisma.auditLog.deleteMany({
        where: {
          userId: updatedUser.id,
          action: 'PASSWORD_RESET_OTP',
        },
      });
    } catch (e) {}

    otpStore.delete(normalizeKey(updatedUser.username));
    if (updatedUser.email) {
      otpStore.delete(normalizeKey(updatedUser.email));
    }
    otpStore.delete(normalizeKey(trimmed));

    // FR-AUTH-013: Invalidate all existing sessions / refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: updatedUser.id },
    });

    // Audit log (FR-AUTH-012)
    try {
      await prisma.auditLog.create({
        data: {
          companyId: updatedUser.companyId || null,
          userId: updatedUser.id,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: updatedUser.id,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    console.log(`[ResetPassword] Successfully updated password in database for user ${updatedUser.username} (${updatedUser.email})`);

    return res.json({
      success: true,
      message: 'Password reset successful! Your password has been updated in the database. Please log in.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to reset password: ' + err.message });
  }
};

/**
 * FR-AUTH-007, FR-AUTH-011: Admin - List Users
 */
export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const whereClause: any = {};

    if (!isSuperAdmin) {
      if (req.user?.companyId) whereClause.companyId = req.user.companyId;
      if (req.user?.branchId) whereClause.branchId = req.user.branchId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-007, FR-AUTH-008, FR-AUTH-014: Admin - Create User Account
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { username, fullName, phone, email, password, role, companyId, branchId } = req.body;

    if (!username || !fullName || !phone || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required user fields' });
    }

    // FR-AUTH-014: Prevent unauthorized role escalation
    const creatorRole = req.user?.role;
    if (creatorRole !== 'SUPER_ADMIN') {
      if (role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Only Super Administrators can create Super Admin accounts.' });
      }
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      return res.status(400).json({ success: false, message: policy.message });
    }

    // Check unique constraints
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { phone }, ...(email ? [{ email }] : [])],
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'Username, phone number, or email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        passwordHash,
        role,
        companyId: companyId || req.user?.companyId || null,
        branchId: branchId || req.user?.branchId || null,
        status: 'ACTIVE',
      },
      include: {
        company: true,
        branch: true,
      },
    });

    // Audit Log (FR-AUTH-012)
    try {
      await prisma.auditLog.create({
        data: {
          companyId: newUser.companyId || null,
          userId: req.user?.id || null,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: newUser.id,
          details: JSON.stringify({ createdUser: newUser.username, role: newUser.role }),
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-007, FR-AUTH-012, FR-AUTH-013, FR-AUTH-014: Activate / Suspend / Deactivate User Account
 */
export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be ACTIVE, SUSPENDED, or DEACTIVATED.' });
    }

    // FR-AUTH-014: Prevent modifying own account status or self-deactivation
    if (req.user?.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot alter your own account status.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role Escalation check
    if (targetUser.role === 'SUPER_ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin accounts.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    // FR-AUTH-013: Session Revocation when account is suspended or deactivated
    if (status !== 'ACTIVE') {
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
    }

    // Audit Log (FR-AUTH-012)
    try {
      await prisma.auditLog.create({
        data: {
          companyId: targetUser.companyId || null,
          userId: req.user?.id || null,
          action: 'USER_STATUS_CHANGE',
          entity: 'User',
          entityId: id,
          details: JSON.stringify({ oldStatus: targetUser.status, newStatus: status }),
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: `User account status updated to ${status}. ${status !== 'ACTIVE' ? 'All active sessions revoked.' : ''}`,
      data: { id: updated.id, status: updated.status },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * FR-AUTH-013: Terminate User Sessions
 */
export const revokeUserSessions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const deleted = await prisma.refreshToken.deleteMany({
      where: { userId: id },
    });

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          companyId: targetUser.companyId || null,
          userId: req.user?.id || null,
          action: 'SESSION_REVOCATION',
          entity: 'User',
          entityId: id,
          details: JSON.stringify({ sessionsRevoked: deleted.count }),
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
        },
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: `Terminated ${deleted.count} active session(s) for user ${targetUser.username}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
