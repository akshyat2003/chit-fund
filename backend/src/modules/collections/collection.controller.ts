import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const recordPayment = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const recordedByUserId = req.user?.id!;
    const {
      subscriberId,
      groupId,
      installmentNo,
      amount,
      paymentMode, // CASH, BANK_TRANSFER, UPI
      externalRef,
      idempotencyKey,
      notes,
    } = req.body;

    if (!subscriberId || !groupId || !installmentNo || !amount || !paymentMode) {
      return res.status(400).json({ success: false, message: 'Missing required payment details' });
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

    // Generate Unique Receipt Number with Company Prefix (FR-COMP-011) e.g. REC-2026-00001
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { receiptPrefix: true } });
    const prefix = company?.receiptPrefix || 'RCT';
    const totalCount = await prisma.paymentTransaction.count({ where: { companyId } });
    const receiptNo = `${prefix}-${new Date().getFullYear()}-${String(totalCount + 1).padStart(5, '0')}`;

    // Execute in Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.create({
        data: {
          companyId,
          branchId: subscriber.branchId,
          subscriberId,
          groupId,
          installmentNo: Number(installmentNo),
          amount: Number(amount),
          paymentMode,
          receiptNo,
          externalRef: externalRef || null,
          recordedByUserId,
          idempotencyKey: idempotencyKey || null,
          verificationStatus: paymentMode === 'CASH' ? 'VERIFIED' : 'PENDING_VERIFICATION',
          notes: notes || null,
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
          details: JSON.stringify({ receiptNo, amount, paymentMode, subscriberId }),
        },
      });

      return { transaction, receipt };
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
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
    const companyId = req.user?.companyId;
    const { subscriberId, groupId, paymentMode, verificationStatus } = req.query;

    const where: any = { companyId };

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
        group: { select: { groupCode: true, name: true } },
        recordedBy: { select: { fullName: true } },
        receipt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: transactions.length, data: transactions });
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
        branch: true,
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
            branch: true,
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
