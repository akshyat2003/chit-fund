import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const listPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { status } = req.query;

    const payouts = await prisma.payout.findMany({
      where: {
        subscriber: { companyId },
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
