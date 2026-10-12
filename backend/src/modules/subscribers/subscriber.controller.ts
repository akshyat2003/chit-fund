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

    // If Collection Staff role and assignedOnly is requested, filter accordingly
    if (req.user?.role === 'COLLECTION_STAFF' && req.query.assignedOnly === 'true') {
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
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
        user: { select: { id: true, username: true, role: true, fullName: true, phone: true } },
        memberships: {
          include: {
            group: { select: { id: true, groupCode: true, name: true, monthlyInstallment: true, status: true } },
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
    let companyId = req.user?.companyId;
    if (!companyId) {
      const defaultComp = await prisma.company.findFirst();
      companyId = defaultComp?.id;
    }

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Valid company reference required' });
    }

    const {
      branchId,
      assignedStaffId,
      fullName,
      phone,
      email,
      address,
      aadhaarNo,
      aadhaarNumber,
      panNo,
      panNumber,
      dateOfBirth,
      userId,
      idProofType,
      idProofNumber,
      nomineeName,
      nomineeRelation,
      nomineePhone,
    } = req.body;

    const cleanName = fullName ? String(fullName).trim() : '';
    const cleanPhone = phone ? String(phone).trim() : '';
    const cleanAddress = address ? String(address).trim() : null;
    const cleanAadhaar = (aadhaarNo || aadhaarNumber) ? String(aadhaarNo || aadhaarNumber).trim() : null;
    const cleanPan = (panNo || panNumber) ? String(panNo || panNumber).trim().toUpperCase() : null;

    if (!cleanName || !cleanPhone) {
      return res.status(400).json({ success: false, message: 'Full name and phone number are required' });
    }

    // Check if phone number already registered as a subscriber
    const existing = await prisma.subscriber.findFirst({
      where: { phone: cleanPhone },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A member with phone ${cleanPhone} is already registered (${existing.subscriberCode} - ${existing.fullName}). The same member can be enrolled into any chit group!`,
        data: existing,
      });
    }

    // Resolve branch
    let effectiveBranchId = branchId || req.user?.branchId;
    if (!effectiveBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { companyId } });
      effectiveBranchId = defaultBranch?.id;
    }

    if (!effectiveBranchId) {
      return res.status(400).json({ success: false, message: 'Valid branch office is required' });
    }

    // Effective assigned staff (if Collection Staff is registering, assign to themselves by default)
    const effectiveStaffId =
      assignedStaffId ||
      (req.user?.role === 'COLLECTION_STAFF' ? req.user.id : null);

    // Generate Subscriber Code e.g. SUB-1004
    const count = await prisma.subscriber.count({ where: { companyId } });
    const subscriberCode = `SUB-${1000 + count + 1}`;

    const subscriber = await prisma.subscriber.create({
      data: {
        companyId,
        branchId: effectiveBranchId,
        assignedStaffId: effectiveStaffId,
        userId: userId || null,
        subscriberCode,
        fullName: cleanName,
        phone: cleanPhone,
        email: email ? String(email).trim().toLowerCase() : null,
        address: cleanAddress,
        aadhaarNo: cleanAadhaar,
        panNo: cleanPan,
        dateOfBirth: dateOfBirth ? String(dateOfBirth).trim() : null,
        idProofType: idProofType || (cleanAadhaar ? 'AADHAAR' : cleanPan ? 'PAN' : null),
        idProofNumber: idProofNumber || cleanAadhaar || cleanPan || null,
        nomineeName: nomineeName ? String(nomineeName).trim() : null,
        nomineeRelation: nomineeRelation ? String(nomineeRelation).trim() : null,
        nomineePhone: nomineePhone ? String(nomineePhone).trim() : null,
        kycStatus: 'VERIFIED',
      },
      include: {
        branch: { select: { name: true, code: true } },
        assignedStaff: { select: { fullName: true, phone: true } },
        user: { select: { id: true, username: true, role: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user?.id,
        action: 'CREATE_SUBSCRIBER',
        entity: 'Subscriber',
        entityId: subscriber.id,
        details: JSON.stringify({ subscriberCode, fullName: cleanName, phone: cleanPhone, isUserLinked: Boolean(userId) }),
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

/**
 * AC-02: KYC Verification
 */
export const verifyKyc = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { kycStatus, kycNotes } = req.body;

    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(kycStatus)) {
      return res.status(400).json({ success: false, message: 'Valid kycStatus (VERIFIED, REJECTED, PENDING) is required' });
    }

    const subscriber = await prisma.subscriber.update({
      where: { id },
      data: {
        kycStatus,
        kycNotes: kycNotes || null,
        kycVerifiedAt: new Date(),
        kycVerifiedByUserId: req.user?.id || null,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          companyId: subscriber.companyId,
          userId: req.user?.id || null,
          action: `KYC_${kycStatus}`,
          entity: 'Subscriber',
          entityId: subscriber.id,
          details: JSON.stringify({
            subscriberCode: subscriber.subscriberCode,
            fullName: subscriber.fullName,
            kycStatus,
            notes: kycNotes,
            verifiedBy: req.user?.fullName || req.user?.phone || req.user?.id,
          }),
          ipAddress: req.ip || 'unknown',
        },
      });
    } catch (e) {}

    return res.json({ success: true, message: `Member KYC marked ${kycStatus}`, data: subscriber });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * AC-04: Member Ledger (Installments, payments, credits, debits, arrears, running balance)
 */
export const getMemberLedger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            group: {
              include: { schedules: { orderBy: { installmentNo: 'asc' } } },
            },
          },
        },
        transactions: {
          where: { isReversed: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    // Calculate aggregated ledger lines
    let totalScheduled = 0;
    let totalDividends = 0;
    let totalPaid = 0;

    const groupLedgers = subscriber.memberships.map((m) => {
      const groupTxns = subscriber.transactions.filter((t) => t.groupId === m.groupId);
      const paidInGroup = groupTxns.reduce((sum, t) => sum + t.amount, 0);

      const schedules = m.group.schedules.map((sch) => {
        totalScheduled += sch.scheduledAmount;
        totalDividends += sch.dividendAmount;
        const matchingTxns = groupTxns.filter((t) => t.installmentNo === sch.installmentNo);
        const installmentPaid = matchingTxns.reduce((s, t) => s + t.amount, 0);
        const outstanding = Math.max(0, sch.netDueAmount - installmentPaid);

        return {
          installmentNo: sch.installmentNo,
          dueDate: sch.dueDate,
          scheduledAmount: sch.scheduledAmount,
          dividendAmount: sch.dividendAmount,
          netDueAmount: sch.netDueAmount,
          paidAmount: installmentPaid,
          outstanding,
          status: outstanding === 0 ? 'PAID' : installmentPaid > 0 ? 'PARTIAL' : 'DUE',
        };
      });

      totalPaid += paidInGroup;

      return {
        groupCode: m.group.groupCode,
        groupName: m.group.name,
        ticketNumber: m.ticketNumber,
        chitValue: m.group.chitValue,
        monthlyInstallment: m.group.monthlyInstallment,
        totalPaidInGroup: paidInGroup,
        schedules,
      };
    });

    const netScheduledDue = totalScheduled - totalDividends;
    const totalArrears = Math.max(0, netScheduledDue - totalPaid);

    return res.json({
      success: true,
      data: {
        subscriber: {
          id: subscriber.id,
          subscriberCode: subscriber.subscriberCode,
          fullName: subscriber.fullName,
          phone: subscriber.phone,
          kycStatus: subscriber.kycStatus,
        },
        summary: {
          totalScheduled,
          totalDividends,
          netScheduledDue,
          totalPaid,
          totalArrears,
        },
        groups: groupLedgers,
        transactions: subscriber.transactions,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * AC-29: Member Statement of Account
 */
export const getMemberStatement = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true, code: true, phone: true } },
        memberships: {
          include: { group: { select: { groupCode: true, name: true, chitValue: true, startDate: true } } },
        },
        transactions: {
          where: { isReversed: false },
          orderBy: { createdAt: 'desc' },
        },
        auctionsWon: true,
        payouts: true,
      },
    });

    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    const totalPaid = subscriber.transactions.reduce((sum, t) => sum + t.amount, 0);

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        subscriber,
        totalPaid,
        activeChitsCount: subscriber.memberships.length,
        payoutsReceivedCount: subscriber.payouts.filter((p) => p.status === 'DISBURSED').length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * AC-30: Outstanding & Arrears Management
 */
export const getMemberOutstanding = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { branchId } = req.query;
    const where: any = { companyId, status: 'ACTIVE' };
    if (branchId) where.branchId = String(branchId);

    const subscribers = await prisma.subscriber.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        memberships: {
          include: {
            group: {
              include: { schedules: true },
            },
          },
        },
        transactions: {
          where: { isReversed: false },
          select: { groupId: true, installmentNo: true, amount: true },
        },
      },
    });

    const outstandingList = subscribers.map((sub) => {
      let totalDue = 0;
      let totalPaid = 0;

      for (const m of sub.memberships) {
        for (const sch of m.group.schedules) {
          totalDue += sch.netDueAmount;
        }
        const groupTxns = sub.transactions.filter((t) => t.groupId === m.groupId);
        totalPaid += groupTxns.reduce((s, t) => s + t.amount, 0);
      }

      const arrears = Math.max(0, totalDue - totalPaid);
      const lateFee = arrears > 0 ? Math.round(arrears * 0.02) : 0; // 2% late charge rule

      return {
        id: sub.id,
        subscriberCode: sub.subscriberCode,
        fullName: sub.fullName,
        phone: sub.phone,
        branchName: sub.branch.name,
        enrolledGroupsCount: sub.memberships.length,
        totalDue,
        totalPaid,
        arrears,
        lateFee,
        totalPayable: arrears + lateFee,
        status: arrears === 0 ? 'CLEAN' : arrears < 10000 ? 'MILD_ARREARS' : 'CRITICAL_ARREARS',
      };
    });

    return res.json({
      success: true,
      count: outstandingList.length,
      data: outstandingList.sort((a, b) => b.arrears - a.arrears),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
