import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    companyId?: string | null;
    role: string;
    phone: string;
    fullName: string;
    sessionId?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Enforce tab-isolated Bearer header authorization to prevent cross-tab cookie bleeding
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const decoded = jwt.verify(token, secret) as any;

    // Single active screen check: verify that this specific session has not been superseded by a new login
    if (decoded.sessionId) {
      const activeSession = await prisma.refreshToken.findUnique({
        where: { id: decoded.sessionId },
      });
      if (!activeSession) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_TERMINATED',
          message: 'This account was logged in from another screen. You have been logged out.',
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        companyId: true,
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
      role: user.role,
      phone: user.phone,
      fullName: user.fullName,
      sessionId: decoded.sessionId,
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
