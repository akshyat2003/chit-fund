import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const recordPayment = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const recordedByUserId = req.user?.id!;
    const userRole = req.user?.role;
    const {
      subscriberId,
      groupId,
      installmentNo,
      amount,
      paymentMode, // CASH, BANK_TRANSFER, UPI
      installmentType = 'REGULAR', // REGULAR, ADVANCE, BACKLOG
      externalRef, // Bank / UPI Txn Ref ID
      receiptPhoto, // Photo of receipt / proof of payment
      idempotencyKey,
      notes,
    } = req.body;

    if (!subscriberId || !groupId || !installmentNo || !amount || !paymentMode) {
      return res.status(400).json({ success: false, message: 'Missing required payment details' });
    }

    // Remark is mandatory for all collections (Cash, UPI, Bank Transfer, Split, etc.)
    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Remark is mandatory for all payment collections. For cash, state cash collection details; for UPI, Bank Transfer or Split payments, specify payment references and breakdown.',
      });
    }

    if ((paymentMode === 'BANK_TRANSFER' || paymentMode === 'UPI' || paymentMode === 'SPLIT') && (!externalRef || !externalRef.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Transaction Reference ID / UTR is required for Bank Transfer, UPI, and Split payments.',
      });
    }

    // Check Idempotency Key
    if (idempotencyKey) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: { idempotencyKey },
        include: { receipt: true, subscriber: true, group: true },
      });
      if (existing) {
        return res.json({ success: true, message: 'Payment already recorded (idempotent)', data: existing });
      }
    }

    const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    const group = await prisma.chitGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    // Role check: Staff can only record collections for their assigned chit group
    if (userRole === 'COLLECTION_STAFF') {
      const staffUserId = req.user!.id;
      const isStaffGroup =
        group.assignedStaffId === staffUserId ||
        (await prisma.chitGroupStaff.findUnique({
          where: {
            groupId_staffId: {
              groupId: group.id,
              staffId: staffUserId,
            },
          },
        }));

      if (!isStaffGroup) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Staff can only record collections for their assigned chit group.',
        });
      }
    }

    // Generate Unique Receipt Number with Company Prefix (FR-COMP-011) e.g. REC-2026-00001
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { receiptPrefix: true } });
    const prefix = company?.receiptPrefix || 'RCT';
    const totalCount = await prisma.paymentTransaction.count({ where: { companyId } });
    const receiptNo = `${prefix}-${new Date().getFullYear()}-${String(totalCount + 1).padStart(5, '0')}`;

    // Staff can only collect and send collection receipt to manager for approval (PENDING_VERIFICATION)
    // Managers can directly collect, receive and approve payment (VERIFIED)
    const verificationStatus = userRole === 'COLLECTION_STAFF' ? 'PENDING_VERIFICATION' : 'VERIFIED';

    // Execute in Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.create({
        data: {
          companyId,
          subscriberId,
          groupId,
          installmentNo: Number(installmentNo),
          amount: Number(amount),
          paymentMode,
          installmentType,
          receiptNo,
          externalRef: externalRef ? externalRef.trim() : null,
          receiptPhoto: receiptPhoto || null,
          recordedByUserId,
          idempotencyKey: idempotencyKey || null,
          verificationStatus,
          notes: notes.trim(),
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          transactionId: transaction.id,
          receiptNo,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: recordedByUserId,
          action: 'RECORD_PAYMENT',
          entity: 'PaymentTransaction',
          entityId: transaction.id,
          details: JSON.stringify({
            receiptNo,
            amount,
            paymentMode,
            installmentType,
            verificationStatus,
            subscriberId,
            notes: notes.trim(),
          }),
        },
      });

      return { transaction, receipt };
    });

    return res.status(201).json({
      success: true,
      message:
        verificationStatus === 'PENDING_VERIFICATION'
          ? 'Receipt submitted successfully and forwarded to manager for approval.'
          : 'Payment recorded and approved successfully.',
      data: {
        ...result.transaction,
        receipt: result.receipt,
        subscriberName: subscriber.fullName,
        subscriberCode: subscriber.subscriberCode,
        groupName: group.name,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listTransactions = async (req: AuthRequest, res: Response) => {
  try {
    let companyId = req.user?.companyId;
    if (!companyId) {
      const firstCo = await prisma.company.findFirst();
      companyId = firstCo?.id;
    }
    const { subscriberId, groupId, paymentMode, verificationStatus } = req.query;

    const where: any = {};
    if (companyId) where.companyId = companyId;

    if (subscriberId) where.subscriberId = String(subscriberId);
    if (groupId) where.groupId = String(groupId);
    if (paymentMode) where.paymentMode = String(paymentMode);
    if (verificationStatus) where.verificationStatus = String(verificationStatus);

    if (req.user?.role === 'COLLECTION_STAFF') {
      where.recordedByUserId = req.user.id;
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        subscriber: { select: { fullName: true, subscriberCode: true, phone: true } },
        group: { select: { groupCode: true, name: true, monthlyInstallment: true } },
        recordedBy: { select: { fullName: true, username: true, role: true } },
        receipt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const digitalCount = transactions.filter((t) => t.paymentMode === 'BANK_TRANSFER' || t.paymentMode === 'UPI' || t.paymentMode === 'SPLIT').length;
    const pendingCount = transactions.filter((t) => t.verificationStatus === 'PENDING_VERIFICATION').length;
    const approvedCount = transactions.filter((t) => t.verificationStatus === 'VERIFIED').length;
    const rejectedCount = transactions.filter((t) => t.verificationStatus === 'REJECTED').length;
    const cashCount = transactions.filter((t) => t.paymentMode === 'CASH').length;

    return res.json({
      success: true,
      count: transactions.length,
      stats: {
        digitalCount,
        pendingCount,
        approvedCount,
        rejectedCount,
        cashCount,
      },
      data: transactions,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getReceiptDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { receiptNo } = req.params;
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { receiptNo },
      include: {
        subscriber: true,
        group: true,
        recordedBy: { select: { fullName: true, phone: true } },
        company: true,
        receipt: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    return res.json({ success: true, data: transaction });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// AC-11 Receipt Reprint tracking
export const reprintReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const { receiptNo } = req.params;
    const receipt = await prisma.receipt.findUnique({
      where: { receiptNo },
      include: {
        transaction: {
          include: {
            subscriber: true,
            group: true,
            company: true,
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const updated = await prisma.receipt.update({
      where: { receiptNo },
      data: { printedCount: { increment: 1 } },
    });

    return res.json({
      success: true,
      message: `Receipt reprinted (Print count: ${updated.printedCount})`,
      data: { ...receipt, printedCount: updated.printedCount },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// AC-12 Payment Reconciliation
export const reconcilePayments = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { transactionIds, status = 'VERIFIED', notes } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'transactionIds array required' });
    }

    const updated = await prisma.paymentTransaction.updateMany({
      where: {
        id: { in: transactionIds },
        companyId,
      },
      data: {
        verificationStatus: status,
        notes: notes ? `Reconciliation: ${notes}` : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'RECONCILE_PAYMENTS',
        entity: 'PaymentTransaction',
        entityId: transactionIds.join(','),
        details: JSON.stringify({ count: updated.count, status, notes }),
      },
    });

    return res.json({
      success: true,
      message: `Successfully reconciled ${updated.count} transactions to ${status}`,
      count: updated.count,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// AC-13 Payment Correction / Reversal
export const reverseTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reversal reason is mandatory' });
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.isReversed) {
      return res.status(400).json({ success: false, message: 'Transaction has already been reversed' });
    }

    // Process reversal preserving original record
    const updated = await prisma.$transaction(async (tx) => {
      const revTx = await tx.paymentTransaction.update({
        where: { id },
        data: {
          isReversed: true,
          reversalReason: reason,
          verificationStatus: 'REVERSED',
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'PAYMENT_REVERSAL',
          entity: 'PaymentTransaction',
          entityId: id,
          details: JSON.stringify({
            originalAmount: transaction.amount,
            receiptNo: transaction.receiptNo,
            subscriberId: transaction.subscriberId,
            reason,
          }),
        },
      });

      return revTx;
    });

    return res.json({
      success: true,
      message: 'Transaction successfully reversed with audit trail preserved',
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Manager / Super Admin: Approve Staff Digital Receipt
export const approveTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { id } = req.params;

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: { subscriber: true, group: true, recordedBy: true },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.verificationStatus === 'VERIFIED') {
      return res.status(400).json({ success: false, message: 'Transaction is already verified / approved' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const appTx = await tx.paymentTransaction.update({
        where: { id },
        data: {
          verificationStatus: 'VERIFIED',
          rejectionReason: null,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'APPROVE_PAYMENT_TRANSACTION',
          entity: 'PaymentTransaction',
          entityId: id,
          details: JSON.stringify({
            receiptNo: transaction.receiptNo,
            amount: transaction.amount,
            paymentMode: transaction.paymentMode,
            approvedBy: req.user?.fullName,
          }),
        },
      });

      return appTx;
    });

    return res.json({
      success: true,
      message: `Transaction ${transaction.receiptNo} has been verified and approved.`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Manager / Super Admin: Reject Staff Digital Receipt
export const rejectTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id!;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: { subscriber: true, group: true, recordedBy: true },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rejTx = await tx.paymentTransaction.update({
        where: { id },
        data: {
          verificationStatus: 'REJECTED',
          rejectionReason: reason.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'REJECT_PAYMENT_TRANSACTION',
          entity: 'PaymentTransaction',
          entityId: id,
          details: JSON.stringify({
            receiptNo: transaction.receiptNo,
            amount: transaction.amount,
            reason: reason.trim(),
            rejectedBy: req.user?.fullName,
          }),
        },
      });

      return rejTx;
    });

    return res.json({
      success: true,
      message: `Transaction ${transaction.receiptNo} has been rejected.`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
