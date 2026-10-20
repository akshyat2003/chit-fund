import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    let companyId = req.user?.companyId;
    if (!companyId) {
      const firstCo = await prisma.company.findFirst();
      companyId = firstCo?.id!;
    }

    if (role === 'SUPER_ADMIN') {
      const [activeCompanies, totalUsers, activeUsers, totalSubscribers, activeGroups] = await Promise.all([
        prisma.company.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.subscriber.count({ where: { status: 'ACTIVE' } }),
        prisma.chitGroup.count({ where: { status: 'ACTIVE' } }),
      ]);

      return res.json({
        success: true,
        data: {
          role,
          activeCompanies,
          totalUsers,
          activeUsers,
          totalSubscribers,
          activeGroups,
          systemStatus: 'ONLINE',
        },
      });
    }

    const whereCompany = companyId ? { companyId } : {};
    const todayStr = new Date().toISOString().split('T')[0];

    if (role === 'MANAGER') {
      const [activeGroups, activeSubscribers, todayTransactions, pendingPayouts, activeStaff, totalStaff] = await Promise.all([
        prisma.chitGroup.count({
          where: { ...whereCompany, status: 'ACTIVE' },
        }),
        prisma.subscriber.count({
          where: { ...whereCompany, status: 'ACTIVE' },
        }),
        prisma.paymentTransaction.findMany({
          where: {
            ...whereCompany,
            verificationStatus: 'VERIFIED',
            isReversed: false,
            createdAt: {
              gte: new Date(`${todayStr}T00:00:00.000Z`),
              lte: new Date(`${todayStr}T23:59:59.999Z`),
            },
          },
        }),
        prisma.payout.count({
          where: { status: 'PENDING', ...(companyId ? { subscriber: { companyId } } : {}) },
        }),
        prisma.user.count({
          where: { ...whereCompany, role: 'COLLECTION_STAFF', status: 'ACTIVE' },
        }),
        prisma.user.count({
          where: { ...whereCompany, role: 'COLLECTION_STAFF' },
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
          activeStaff,
          totalStaff,
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
    const [assignedSubscribers, todayTransactions] = await Promise.all([
      prisma.subscriber.count({
        where: { ...whereCompany, assignedStaffId: staffId, status: 'ACTIVE' },
      }),
      prisma.paymentTransaction.findMany({
        where: {
          recordedByUserId: staffId,
          isReversed: false,
          createdAt: {
            gte: new Date(`${todayStr}T00:00:00.000Z`),
            lte: new Date(`${todayStr}T23:59:59.999Z`),
          },
        },
      }),
    ]);

    // Only VERIFIED transactions count. REJECTED collections NEVER count.
    const approvedTransactions = todayTransactions.filter((t) => t.verificationStatus === 'VERIFIED');
    const pendingTransactions = todayTransactions.filter((t) => t.verificationStatus === 'PENDING_VERIFICATION');

    const todayAmountCollected = approvedTransactions.reduce((acc, t) => acc + t.amount, 0);
    const cashInHand = approvedTransactions.filter((t) => t.paymentMode === 'CASH').reduce((acc, t) => acc + t.amount, 0);
    const pendingApprovalAmount = pendingTransactions.reduce((acc, t) => acc + t.amount, 0);

    return res.json({
      success: true,
      data: {
        role,
        assignedSubscribers,
        todayCollectionsCount: approvedTransactions.length,
        todayAmountCollected,
        cashInHand,
        pendingApprovalCount: pendingTransactions.length,
        pendingApprovalAmount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
