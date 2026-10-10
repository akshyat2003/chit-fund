import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const listSubscribers = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { branchId, search, kycStatus, staffId } = req.query;

    const where: any = { companyId };

    if (branchId) where.branchId = String(branchId);
    if (kycStatus) where.kycStatus = String(kycStatus);
    if (staffId) where.assignedStaffId = String(staffId);

    // If Collection Staff role, restrict to their assigned subscribers or branch
    if (req.user?.role === 'COLLECTION_STAFF') {
      where.OR = [
        { assignedStaffId: req.user.id },
        { branchId: req.user.branchId || undefined },
      ];
    }

    if (search) {
      const q = String(search);
      where.OR = [
        { fullName: { contains: q } },
        { subscriberCode: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const subscribers = await prisma.subscriber.findMany({
      where,
      include: {
        branch: { select: { name: true, code: true } },
        assignedStaff: { select: { fullName: true, phone: true } },
        memberships: {
          include: {
            group: { select: { groupCode: true, name: true, monthlyInstallment: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: subscribers.length, data: subscribers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createSubscriber = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const {
      branchId,
      assignedStaffId,
      fullName,
      phone,
      email,
      address,
      dateOfBirth,
      idProofType,
      idProofNumber,
      nomineeName,
      nomineeRelation,
      nomineePhone,
    } = req.body;

    if (!fullName || !phone || !branchId) {
      return res.status(400).json({ success: false, message: 'Full name, phone, and branchId are required' });
    }

    // Generate Subscriber Code e.g. SUB-1004
    const count = await prisma.subscriber.count({ where: { companyId } });
    const subscriberCode = `SUB-${1000 + count + 1}`;

    const subscriber = await prisma.subscriber.create({
      data: {
        companyId,
        branchId,
        assignedStaffId,
        subscriberCode,
        fullName,
        phone,
        email,
        address,
        dateOfBirth,
        idProofType,
        idProofNumber,
        nomineeName,
        nomineeRelation,
        nomineePhone,
        kycStatus: 'VERIFIED',
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user?.id,
        action: 'CREATE_SUBSCRIBER',
        entity: 'Subscriber',
        entityId: subscriber.id,
        details: JSON.stringify({ subscriberCode, fullName, phone }),
      },
    });

    return res.status(201).json({ success: true, data: subscriber });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getSubscriberById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      include: {
        branch: true,
        assignedStaff: { select: { fullName: true, phone: true } },
        memberships: {
          include: {
            group: {
              include: {
                schedules: true,
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        auctionsWon: true,
        payouts: true,
      },
    });

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    return res.json({ success: true, data: subscriber });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
