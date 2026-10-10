import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const companyId = req.user?.companyId!;

    if (role === 'SUPER_ADMIN') {
      const activeCompanies = await prisma.company.count({ where: { status: 'ACTIVE' } });
      const activeBranches = await prisma.branch.count({ where: { status: 'ACTIVE' } });
      const totalUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });
      const totalSubscribers = await prisma.subscriber.count({ where: { status: 'ACTIVE' } });
      const activeGroups = await prisma.chitGroup.count({ where: { status: 'ACTIVE' } });

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

      const activeGroups = await prisma.chitGroup.count({
        where: { companyId, status: 'ACTIVE', ...whereBranch },
      });
      const activeSubscribers = await prisma.subscriber.count({
        where: { companyId, status: 'ACTIVE', ...whereBranch },
      });

      // Today's collections
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTransactions = await prisma.paymentTransaction.findMany({
        where: {
          companyId,
          verificationStatus: { not: 'REVERSED' },
          createdAt: {
            gte: new Date(`${todayStr}T00:00:00.000Z`),
            lte: new Date(`${todayStr}T23:59:59.999Z`),
          },
        },
      });

      const todayTotalCollected = todayTransactions.reduce((acc, t) => acc + t.amount, 0);
      const todayCashCollected = todayTransactions.filter(t => t.paymentMode === 'CASH').reduce((acc, t) => acc + t.amount, 0);
      const todayBankUpiCollected = todayTransactions.filter(t => t.paymentMode !== 'CASH').reduce((acc, t) => acc + t.amount, 0);

      const pendingPayouts = await prisma.payout.count({
        where: { status: 'PENDING', subscriber: { companyId } },
      });

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
    const assignedSubscribers = await prisma.subscriber.count({
      where: { companyId, assignedStaffId: staffId, status: 'ACTIVE' },
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTransactions = await prisma.paymentTransaction.findMany({
      where: {
        recordedByUserId: staffId,
        verificationStatus: { not: 'REVERSED' },
        createdAt: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
          lte: new Date(`${todayStr}T23:59:59.999Z`),
        },
      },
    });

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
