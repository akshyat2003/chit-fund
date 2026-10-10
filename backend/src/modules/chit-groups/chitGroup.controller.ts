import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const listChitGroups = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { branchId, status } = req.query;

    const where: any = { companyId };
    if (branchId) where.branchId = String(branchId);
    if (status) where.status = String(status);

    const groups = await prisma.chitGroup.findMany({
      where,
      include: {
        branch: { select: { name: true, code: true } },
        members: {
          include: {
            subscriber: { select: { fullName: true, subscriberCode: true, phone: true } },
          },
        },
        schedules: { orderBy: { installmentNo: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, count: groups.length, data: groups });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createChitGroup = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId!;
    const {
      branchId,
      name,
      chitValue,
      maxMembers,
      totalMonths,
      foremanCommissionPct = 5.0,
      startDate,
    } = req.body;

    if (!name || !chitValue || !maxMembers || !totalMonths || !startDate || !branchId) {
      return res.status(400).json({ success: false, message: 'Missing required chit group configuration parameters' });
    }

    const monthlyInstallment = Number(chitValue) / Number(totalMonths);
    const count = await prisma.chitGroup.count({ where: { companyId } });
    const groupCode = `CG-${2026 + count + 1}`;

    const group = await prisma.chitGroup.create({
      data: {
        companyId,
        branchId,
        groupCode,
        name,
        chitValue: Number(chitValue),
        maxMembers: Number(maxMembers),
        totalMonths: Number(totalMonths),
        monthlyInstallment,
        foremanCommissionPct: Number(foremanCommissionPct),
        startDate,
        status: 'ACTIVE',
      },
    });

    // Auto-generate Installment Schedules for all totalMonths
    const start = new Date(startDate);
    const scheduleData = [];
    for (let i = 1; i <= Number(totalMonths); i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      
      scheduleData.push({
        groupId: group.id,
        installmentNo: i,
        dueDate: dueDate.toISOString().split('T')[0],
        scheduledAmount: monthlyInstallment,
        dividendAmount: 0.0,
        netDueAmount: monthlyInstallment,
      });
    }

    await prisma.installmentSchedule.createMany({
      data: scheduleData,
    });

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: req.user?.id,
        action: 'CREATE_CHIT_GROUP',
        entity: 'ChitGroup',
        entityId: group.id,
        details: JSON.stringify({ groupCode, chitValue, totalMonths }),
      },
    });

    return res.status(201).json({ success: true, data: group });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const enrollSubscriber = async (req: AuthRequest, res: Response) => {
  try {
    const { groupId, subscriberId } = req.body;

    if (!groupId || !subscriberId) {
      return res.status(400).json({ success: false, message: 'groupId and subscriberId are required' });
    }

    const group = await prisma.chitGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ success: false, message: 'Chit group has reached maximum member capacity' });
    }

    const ticketNumber = group.members.length + 1;

    const membership = await prisma.chitGroupMember.create({
      data: {
        groupId,
        subscriberId,
        ticketNumber,
      },
    });

    return res.status(201).json({ success: true, data: membership });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getChitGroupDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const group = await prisma.chitGroup.findUnique({
      where: { id },
      include: {
        branch: true,
        members: {
          include: {
            subscriber: true,
          },
        },
        schedules: { orderBy: { installmentNo: 'asc' } },
        auctions: {
          include: {
            winnerSubscriber: true,
          },
          orderBy: { installmentNo: 'asc' },
        },
        transactions: {
          include: {
            subscriber: { select: { fullName: true, subscriberCode: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    return res.json({ success: true, data: group });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
