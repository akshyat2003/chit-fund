import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    companyId: string;
    branchId?: string | null;
    role: string;
    phone: string;
    fullName: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'chitfund_super_secure_jwt_secret_key_2026!@#';
    const decoded = jwt.verify(token, secret) as any;

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
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'User account is inactive or disabled' });
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
