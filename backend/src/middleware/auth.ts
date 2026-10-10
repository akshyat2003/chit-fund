import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    companyId?: string | null;
    branchId?: string | null;
    role: string;
    phone: string;
    fullName: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Support both HTTP-only Cookies and Bearer Authorization Header
  const tokenFromCookie = req.cookies?.token;
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  const token = tokenFromCookie || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const decoded = jwt.verify(token, secret) as any;

    // Single Active Session / Window Enforcement:
    // If another window or user logged in with the same credential, the previous sessionId was deleted
    if (decoded.sessionId) {
      const activeSession = await prisma.refreshToken.findUnique({
        where: { id: decoded.sessionId },
      });
      if (!activeSession) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_TERMINATED',
          message: 'Your account was logged in from another window or device. This session has been terminated.',
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        role: true,
        phone: true,
        fullName: true,
        status: true,
        company: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'User account is inactive or disabled' });
    }

    // FR-SA-014: Prohibit suspended companies from performing business write operations while preserving historical read access
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.company &&
      user.company.status === 'SUSPENDED' &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Policy FR-SA-014 Enforced: Company account is currently suspended. Business operations are prohibited while historical records remain accessible.',
      });
    }

    req.user = {
      id: user.id,
      companyId: user.companyId,
      branchId: user.branchId,
      role: user.role,
      phone: user.phone,
      fullName: user.fullName,
    };

    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired authentication token' });
  }
};

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};
