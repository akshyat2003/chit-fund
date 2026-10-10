import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const companyId = req.user?.companyId!;

    if (role === 'SUPER_ADMIN') {
      const [activeCompanies, activeBranches, totalUsers, totalSubscribers, activeGroups] = await Promise.all([
        prisma.company.count({ where: { status: 'ACTIVE' } }),
        prisma.branch.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.subscriber.count({ where: { status: 'ACTIVE' } }),
        prisma.chitGroup.count({ where: { status: 'ACTIVE' } }),
      ]);

      return res.json({
        success: true,
        data: {
          role,
          activeCompanies,
          activeBranches,
          totalUsers,
          totalSubscribers,
          activeGroups,
          systemStatus: 'ONLINE',
        },
      });
    }

    if (role === 'MANAGER') {
      const branchId = req.user?.branchId;
      const whereBranch = branchId ? { branchId } : {};
      const todayStr = new Date().toISOString().split('T')[0];

      const [activeGroups, activeSubscribers, todayTransactions, pendingPayouts] = await Promise.all([
        prisma.chitGroup.count({
          where: { companyId, status: 'ACTIVE', ...whereBranch },
        }),
        prisma.subscriber.count({
          where: { companyId, status: 'ACTIVE', ...whereBranch },
        }),
        prisma.paymentTransaction.findMany({
          where: {
            companyId,
            verificationStatus: { not: 'REVERSED' },
            createdAt: {
              gte: new Date(`${todayStr}T00:00:00.000Z`),
              lte: new Date(`${todayStr}T23:59:59.999Z`),
            },
          },
        }),
        prisma.payout.count({
          where: { status: 'PENDING', subscriber: { companyId } },
        }),
      ]);

      const todayTotalCollected = todayTransactions.reduce((acc, t) => acc + t.amount, 0);
      const todayCashCollected = todayTransactions.filter(t => t.paymentMode === 'CASH').reduce((acc, t) => acc + t.amount, 0);
      const todayBankUpiCollected = todayTransactions.filter(t => t.paymentMode !== 'CASH').reduce((acc, t) => acc + t.amount, 0);

      return res.json({
        success: true,
        data: {
          role,
          activeGroups,
          activeSubscribers,
          todayTotalCollected,
          todayCashCollected,
          todayBankUpiCollected,
          todayTxnCount: todayTransactions.length,
          pendingPayouts,
        },
      });
    }

    // COLLECTION_STAFF role
    const staffId = req.user?.id!;
    const todayStr = new Date().toISOString().split('T')[0];

    const [assignedSubscribers, todayTransactions] = await Promise.all([
      prisma.subscriber.count({
        where: { companyId, assignedStaffId: staffId, status: 'ACTIVE' },
      }),
      prisma.paymentTransaction.findMany({
        where: {
          recordedByUserId: staffId,
          verificationStatus: { not: 'REVERSED' },
          createdAt: {
            gte: new Date(`${todayStr}T00:00:00.000Z`),
            lte: new Date(`${todayStr}T23:59:59.999Z`),
          },
        },
      }),
    ]);

    const todayAmountCollected = todayTransactions.reduce((acc, t) => acc + t.amount, 0);
    const cashInHand = todayTransactions.filter(t => t.paymentMode === 'CASH').reduce((acc, t) => acc + t.amount, 0);

    return res.json({
      success: true,
      data: {
        role,
        assignedSubscribers,
        todayCollectionsCount: todayTransactions.length,
        todayAmountCollected,
        cashInHand,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
