import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const listPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { status } = req.query;

    const payouts = await prisma.payout.findMany({
      where: {
        ...(companyId ? { subscriber: { companyId } } : {}),
        status: status ? String(status) : undefined,
      },
      include: {
        subscriber: { select: { fullName: true, subscriberCode: true, phone: true } },
        auction: {
          include: {
            group: { select: { name: true, groupCode: true } },
          },
        },
        approvedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: payouts.length, data: payouts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePayoutStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, deductions, paymentMode, transactionRef } = req.body;
    const userId = req.user?.id;

    if (!['APPROVED', 'DISBURSED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid payout status' });
    }

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout record not found' });
    }

    const netPayoutAmount = payout.grossBidAmount - (deductions !== undefined ? Number(deductions) : payout.deductions);

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status,
        deductions: deductions !== undefined ? Number(deductions) : payout.deductions,
        netPayoutAmount,
        paymentMode: paymentMode || payout.paymentMode,
        transactionRef: transactionRef || payout.transactionRef,
        approvedByUserId: status === 'APPROVED' || status === 'DISBURSED' ? userId : payout.approvedByUserId,
        approvedAt: status === 'APPROVED' ? new Date() : payout.approvedAt,
        disbursedAt: status === 'DISBURSED' ? new Date() : payout.disbursedAt,
      },
    });

    return res.json({ success: true, message: `Payout status updated to ${status}`, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// AC-28: Refund Management
export const listRefunds = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { status, subscriberId } = req.query;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = String(status);
    if (subscriberId) where.subscriberId = String(subscriberId);

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        subscriber: { select: { fullName: true, subscriberCode: true, phone: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: refunds.length, data: refunds });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createRefundRequest = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { subscriberId, groupId, amount, reason } = req.body;

    if (!subscriberId || !groupId || !amount || !reason) {
      return res.status(400).json({ success: false, message: 'Subscriber, Group, Amount and Reason are required' });
    }

    const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    const refund = await prisma.refund.create({
      data: {
        companyId,
        branchId: subscriber.branchId,
        subscriberId,
        groupId,
        amount: Number(amount),
        reason,
        status: 'REQUESTED',
      },
      include: {
        subscriber: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'REFUND_REQUESTED',
        entity: 'Refund',
        entityId: refund.id,
        details: JSON.stringify({ amount, reason, subscriberId }),
      },
    });

    return res.status(201).json({ success: true, message: 'Refund request submitted', data: refund });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const processRefund = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { id } = req.params;
    const { status } = req.body; // APPROVED, DISBURSED, REJECTED

    if (!['APPROVED', 'DISBURSED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid refund status' });
    }

    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }

    const updated = await prisma.refund.update({
      where: { id },
      data: {
        status,
        approvedByUserId: status === 'APPROVED' || status === 'DISBURSED' ? userId : refund.approvedByUserId,
        approvedAt: status === 'APPROVED' ? new Date() : refund.approvedAt,
        disbursedAt: status === 'DISBURSED' ? new Date() : refund.disbursedAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: `REFUND_${status}`,
        entity: 'Refund',
        entityId: refund.id,
        details: JSON.stringify({ previousStatus: refund.status, newStatus: status }),
      },
    });

    return res.json({ success: true, message: `Refund marked as ${status}`, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
