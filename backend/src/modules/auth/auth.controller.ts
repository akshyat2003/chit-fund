import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

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

    // Store Refresh Token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
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
