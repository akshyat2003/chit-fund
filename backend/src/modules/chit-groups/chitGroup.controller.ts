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
      totalChitValue,
      maxMembers,
      totalMonths,
      durationMonths,
      monthlyInstallment,
      foremanCommissionPct,
      foremanCommissionRate,
      startDate,
    } = req.body;

    const effectiveChitValue = Number(chitValue ?? totalChitValue);
    const effectiveTotalMonths = Number(totalMonths ?? durationMonths);
    const effectiveMaxMembers = Number(maxMembers || effectiveTotalMonths);
    const effectiveCommission = Number(foremanCommissionPct ?? foremanCommissionRate ?? 5.0);

    let effectiveBranchId = branchId || req.user?.branchId;
    if (!effectiveBranchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { companyId } });
      effectiveBranchId = defaultBranch?.id;
    }

    if (!name || !effectiveChitValue || !effectiveMaxMembers || !effectiveTotalMonths || !startDate || !effectiveBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required chit group configuration parameters (name, chitValue, totalMonths, maxMembers, startDate)',
      });
    }

    const calculatedInstallment = Number(monthlyInstallment) || (effectiveChitValue / effectiveTotalMonths);
    const count = await prisma.chitGroup.count({ where: { companyId } });
    const groupCode = `CG-${2026 + count + 1}`;

    const group = await prisma.chitGroup.create({
      data: {
        companyId,
        branchId: effectiveBranchId,
        groupCode,
        name: name.trim(),
        chitValue: effectiveChitValue,
        maxMembers: effectiveMaxMembers,
        totalMonths: effectiveTotalMonths,
        monthlyInstallment: calculatedInstallment,
        foremanCommissionPct: effectiveCommission,
        startDate,
        status: 'ACTIVE',
      },
      include: {
        branch: { select: { name: true, code: true } },
      },
    });

    // Auto-generate Installment Schedules for all totalMonths
    const start = new Date(startDate);
    const scheduleData = [];
    for (let i = 1; i <= effectiveTotalMonths; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      scheduleData.push({
        groupId: group.id,
        installmentNo: i,
        dueDate: dueDate.toISOString().split('T')[0],
        scheduledAmount: calculatedInstallment,
        dividendAmount: 0.0,
        netDueAmount: calculatedInstallment,
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
        details: JSON.stringify({ groupCode, chitValue: effectiveChitValue, totalMonths: effectiveTotalMonths }),
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

export const updateChitGroup = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const {
      name,
      chitValue,
      totalChitValue,
      maxMembers,
      totalMonths,
      durationMonths,
      monthlyInstallment,
      foremanCommissionPct,
      foremanCommissionRate,
      startDate,
      endDate,
      status,
      branchId,
    } = req.body;

    const existingGroup = await prisma.chitGroup.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true, auctions: true, members: true } } },
    });

    if (!existingGroup) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    if (req.user?.role !== 'SUPER_ADMIN' && existingGroup.companyId !== companyId) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot update group outside your company' });
    }

    const newChitValue =
      chitValue !== undefined
        ? Number(chitValue)
        : totalChitValue !== undefined
        ? Number(totalChitValue)
        : existingGroup.chitValue;
    const newTotalMonths =
      totalMonths !== undefined
        ? Number(totalMonths)
        : durationMonths !== undefined
        ? Number(durationMonths)
        : existingGroup.totalMonths;
    const newCommission =
      foremanCommissionPct !== undefined
        ? Number(foremanCommissionPct)
        : foremanCommissionRate !== undefined
        ? Number(foremanCommissionRate)
        : existingGroup.foremanCommissionPct;
    const newMonthly =
      monthlyInstallment !== undefined
        ? Number(monthlyInstallment)
        : newChitValue / newTotalMonths;

    if (maxMembers && Number(maxMembers) < existingGroup._count.members) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce member capacity to ${maxMembers} as ${existingGroup._count.members} members are already enrolled.`,
      });
    }

    const updated = await prisma.chitGroup.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existingGroup.name,
        chitValue: newChitValue,
        totalMonths: newTotalMonths,
        monthlyInstallment: newMonthly,
        foremanCommissionPct: newCommission,
        maxMembers: maxMembers !== undefined ? Number(maxMembers) : existingGroup.maxMembers,
        startDate: startDate || existingGroup.startDate,
        endDate: endDate !== undefined ? endDate : existingGroup.endDate,
        status: status || existingGroup.status,
        branchId: branchId || existingGroup.branchId,
      },
      include: {
        branch: { select: { name: true, code: true } },
      },
    });

    // If schedules can be refreshed safely when no auctions or transactions have occurred:
    if (
      existingGroup._count.auctions === 0 &&
      existingGroup._count.transactions === 0 &&
      (newTotalMonths !== existingGroup.totalMonths ||
        newChitValue !== existingGroup.chitValue ||
        startDate !== existingGroup.startDate)
    ) {
      await prisma.installmentSchedule.deleteMany({ where: { groupId: id } });
      const start = new Date(updated.startDate);
      const scheduleData = [];
      for (let i = 1; i <= Number(newTotalMonths); i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        scheduleData.push({
          groupId: id,
          installmentNo: i,
          dueDate: dueDate.toISOString().split('T')[0],
          scheduledAmount: newMonthly,
          dividendAmount: 0.0,
          netDueAmount: newMonthly,
        });
      }
      await prisma.installmentSchedule.createMany({ data: scheduleData });
    }

    await prisma.auditLog.create({
      data: {
        companyId: existingGroup.companyId,
        userId: req.user?.id,
        action: 'UPDATE_CHIT_GROUP',
        entity: 'ChitGroup',
        entityId: id,
        details: JSON.stringify({ name: updated.name, chitValue: updated.chitValue, status: updated.status }),
      },
    });

    return res.json({ success: true, message: 'Chit group updated successfully', data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteChitGroup = async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const group = await prisma.chitGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            auctions: true,
            members: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    if (req.user?.role !== 'SUPER_ADMIN' && group.companyId !== companyId) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot delete group outside your company' });
    }

    if (group._count.transactions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete chit group '${group.name}' because it contains ${group._count.transactions} payment transaction(s). Please set its status to CANCELLED or COMPLETED instead.`,
      });
    }

    if (group._count.auctions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete chit group '${group.name}' because ${group._count.auctions} auction(s) have already been conducted.`,
      });
    }

    await prisma.chitGroupMember.deleteMany({ where: { groupId: id } });
    await prisma.installmentSchedule.deleteMany({ where: { groupId: id } });
    await prisma.chitGroup.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        companyId: group.companyId,
        userId: req.user?.id,
        action: 'DELETE_CHIT_GROUP',
        entity: 'ChitGroup',
        entityId: id,
        details: JSON.stringify({ name: group.name, groupCode: group.groupCode }),
      },
    });

    return res.json({ success: true, message: `Chit group '${group.name}' deleted successfully.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
