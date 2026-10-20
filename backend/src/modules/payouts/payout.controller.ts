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

// AC-28: Surrender & Refund Management
export const listRefunds = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { status, subscriberId } = req.query;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = String(status);
    if (subscriberId) where.subscriberId = String(subscriberId);

    // If Collection Staff, restrict to members or chit groups assigned to this staff
    if (req.user?.role === 'COLLECTION_STAFF') {
      const staffId = req.user.id;
      where.OR = [
        { subscriber: { assignedStaffId: staffId } },
        { subscriber: { memberships: { some: { group: { OR: [{ assignedStaffId: staffId }, { staffAssignments: { some: { staffId } } }] } } } } },
      ];
    }

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        subscriber: {
          select: {
            id: true,
            fullName: true,
            subscriberCode: true,
            phone: true,
            assignedStaff: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Populate chit group details
    const groupIds = [...new Set(refunds.map((r) => r.groupId).filter(Boolean))];
    const groups = await prisma.chitGroup.findMany({
      where: { id: { in: groupIds } },
      select: {
        id: true,
        name: true,
        groupCode: true,
        monthlyInstallment: true,
        chitValue: true,
        assignedStaff: { select: { id: true, fullName: true } },
      },
    });
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const enriched = refunds.map((r) => ({
      ...r,
      group: groupMap.get(r.groupId) || null,
    }));

    return res.json({ success: true, count: enriched.length, data: enriched });
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

    const subscriber = await prisma.subscriber.findUnique({
      where: { id: subscriberId },
      include: { assignedStaff: { select: { id: true, fullName: true, phone: true } } },
    });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    const group = await prisma.chitGroup.findUnique({
      where: { id: groupId },
      include: { assignedStaff: { select: { id: true, fullName: true } } },
    });

    const assignedStaffName = subscriber.assignedStaff?.fullName || group?.assignedStaff?.fullName || 'Assigned Staff';
    const isStaff = req.user?.role === 'COLLECTION_STAFF';
    // If manager clicks surrender & refund, it assigns to staff. If staff collects directly, it goes to submitted to manager.
    const initialStatus = isStaff ? 'SUBMITTED_TO_MANAGER' : 'ASSIGNED_TO_STAFF';
    const formattedReason = `Surrender: ${reason.trim()} | Assigned to Staff: ${assignedStaffName}`;

    const refund = await prisma.refund.create({
      data: {
        companyId,
        subscriberId,
        groupId,
        amount: Number(amount),
        reason: formattedReason,
        status: initialStatus,
      },
      include: {
        subscriber: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'SURRENDER_REFUND_REQUESTED',
        entity: 'Refund',
        entityId: refund.id,
        details: JSON.stringify({ amount, reason, subscriberId, groupId, assignedStaff: assignedStaffName, status: initialStatus }),
      },
    });

    return res.status(201).json({
      success: true,
      message: isStaff
        ? 'Surrender & refund collected and submitted to manager for approval.'
        : `Surrender & refund request created and assigned to ${assignedStaffName}.`,
      data: { ...refund, group },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const processRefund = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { id } = req.params;
    const { status, notes, rejectionReason } = req.body; // 'SUBMITTED_TO_MANAGER', 'APPROVED', 'DISBURSED', 'REJECTED'

    if (!['ASSIGNED_TO_STAFF', 'SUBMITTED_TO_MANAGER', 'APPROVED', 'DISBURSED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid surrender / refund status' });
    }

    const refund = await prisma.refund.findUnique({
      where: { id },
      include: { subscriber: true },
    });
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund record not found' });
    }

    // Role check: Staff can only collect and submit to manager
    if (req.user?.role === 'COLLECTION_STAFF') {
      if (status !== 'SUBMITTED_TO_MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Staff can only collect surrender documents and submit to manager for approval.',
        });
      }
    }

    let updatedReason = refund.reason;
    if (status === 'SUBMITTED_TO_MANAGER' && notes) {
      updatedReason += ` | Staff Collection Notes: ${notes.trim()}`;
    } else if (status === 'REJECTED' && rejectionReason) {
      updatedReason += ` | Rejection Reason: ${rejectionReason.trim()}`;
    }

    const updated = await prisma.refund.update({
      where: { id },
      data: {
        status,
        reason: updatedReason,
        approvedByUserId: status === 'APPROVED' || status === 'DISBURSED' ? userId : refund.approvedByUserId,
        approvedAt: status === 'APPROVED' ? new Date() : refund.approvedAt,
        disbursedAt: status === 'DISBURSED' ? new Date() : refund.disbursedAt,
      },
    });

    // When manager APPROVES the surrender:
    // Surrender member from the chit group so future installment calculation stops!
    if (status === 'APPROVED' || status === 'DISBURSED') {
      await prisma.chitGroupMember.deleteMany({
        where: {
          groupId: refund.groupId,
          subscriberId: refund.subscriberId,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: `SURRENDER_REFUND_${status}`,
        entity: 'Refund',
        entityId: refund.id,
        details: JSON.stringify({
          previousStatus: refund.status,
          newStatus: status,
          groupId: refund.groupId,
          subscriberId: refund.subscriberId,
          amount: refund.amount,
        }),
      },
    });

    return res.json({
      success: true,
      message:
        status === 'SUBMITTED_TO_MANAGER'
          ? 'Surrender details collected and submitted to Manager for approval.'
          : status === 'APPROVED'
          ? 'Surrender & refund approved. Member membership surrendered from chit group; calculation updated.'
          : status === 'REJECTED'
          ? 'Surrender request rejected. Member remains active in chit group and calculation continues.'
          : `Refund marked as ${status}`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
