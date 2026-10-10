import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const submitCashHandover = async (req: AuthRequest, res: Response) => {
  try {
    const staffUserId = req.user?.id!;
    const branchId = req.user?.branchId!;
    const { handoverDate, actualCash, notes } = req.body;

    if (!handoverDate || actualCash === undefined) {
      return res.status(400).json({ success: false, message: 'handoverDate and actualCash are required' });
    }

    // Calculate total expected cash recorded by staff on handoverDate
    const transactions = await prisma.paymentTransaction.findMany({
      where: {
        recordedByUserId: staffUserId,
        paymentMode: 'CASH',
        verificationStatus: { not: 'REVERSED' },
        createdAt: {
          gte: new Date(`${handoverDate}T00:00:00.000Z`),
          lte: new Date(`${handoverDate}T23:59:59.999Z`),
        },
      },
    });

    const expectedCash = transactions.reduce((sum, t) => sum + t.amount, 0);
    const difference = Number(actualCash) - expectedCash;
    const status = Math.abs(difference) < 0.01 ? 'SUBMITTED' : 'DISCREPANCY';

    const handover = await prisma.cashHandover.create({
      data: {
        branchId,
        staffUserId,
        handoverDate,
        expectedCash,
        actualCash: Number(actualCash),
        difference,
        status,
        notes,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Cash handover report submitted successfully',
      data: handover,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listHandovers = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { branchId, status } = req.query;

    const where: any = {
      branch: { companyId },
    };

    if (branchId) where.branchId = String(branchId);
    if (status) where.status = String(status);

    if (req.user?.role === 'COLLECTION_STAFF') {
      where.staffUserId = req.user.id;
    }

    const handovers = await prisma.cashHandover.findMany({
      where,
      include: {
        staff: { select: { fullName: true, phone: true } },
        verifiedBy: { select: { fullName: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: handovers.length, data: handovers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyHandover = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const managerUserId = req.user?.id!;

    const handover = await prisma.cashHandover.findUnique({ where: { id } });
    if (!handover) {
      return res.status(404).json({ success: false, message: 'Handover record not found' });
    }

    const updated = await prisma.cashHandover.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedByUserId: managerUserId,
        verifiedAt: new Date(),
        notes: notes || handover.notes,
      },
    });

    return res.json({ success: true, message: 'Handover verified and marked complete', data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
