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

    // Generate Unique Receipt Number e.g. RCT-2026-0001
    const totalCount = await prisma.paymentTransaction.count({ where: { companyId } });
    const receiptNo = `RCT-${new Date().getFullYear()}-${String(totalCount + 1).padStart(5, '0')}`;

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
