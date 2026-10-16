import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const listChitGroups = async (req: AuthRequest, res: Response) => {
  try {
    let companyId = req.user?.companyId;
    if (!companyId) {
      const firstCo = await prisma.company.findFirst();
      companyId = firstCo?.id;
    }
    const { status } = req.query;

    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = String(status);

    // Collection staff can only list and see their assigned chit groups
    if (req.user?.role === 'COLLECTION_STAFF') {
      const staffUserId = req.user.id;
      where.OR = [
        { assignedStaffId: staffUserId },
        { staffAssignments: { some: { staffId: staffUserId } } },
      ];
    }

    const groups = await prisma.chitGroup.findMany({
      where,
      include: {
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
        staffAssignments: {
          include: {
            staff: { select: { id: true, fullName: true, username: true, phone: true } },
          },
        },
        members: {
          include: {
            subscriber: {
              select: {
                id: true,
                fullName: true,
                subscriberCode: true,
                phone: true,
                email: true,
                address: true,
                aadhaarNo: true,
                panNo: true,
                dateOfBirth: true,
                nomineeName: true,
                nomineeRelation: true,
                nomineePhone: true,
                kycStatus: true,
                assignedStaffId: true,
              },
            },
          },
        },
        schedules: { orderBy: { installmentNo: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedGroups = groups.map((g) => {
      if (req.user?.role === 'COLLECTION_STAFF') {
        const staffUserId = req.user.id;
        const isStaffGroup =
          g.assignedStaffId === staffUserId ||
          g.staffAssignments?.some((sa: any) => sa.staffId === staffUserId);

        const assignedMembers = isStaffGroup
          ? g.members
          : g.members.filter(
              (m: any) => m.subscriber?.assignedStaffId === staffUserId
            );

        return {
          ...g,
          members: assignedMembers,
        };
      }
      return g;
    });

    return res.json({ success: true, count: sanitizedGroups.length, data: sanitizedGroups });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createChitGroup = async (req: AuthRequest, res: Response) => {
  try {
    let companyId = req.user?.companyId;
    if (!companyId) {
      const firstCo = await prisma.company.findFirst();
      companyId = firstCo?.id!;
    }
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
      assignedStaffId,
      assignedStaffIds,
      staffIds,
    } = req.body;

    const effectiveTotalMonths = Number(totalMonths ?? durationMonths);
    const effectiveInstallment = Number(monthlyInstallment);
    const effectiveChitValue = Number(chitValue ?? totalChitValue) || (effectiveInstallment * effectiveTotalMonths);
    const effectiveMaxMembers = Number(maxMembers || effectiveTotalMonths);
    const effectiveCommission = Number(foremanCommissionPct ?? foremanCommissionRate ?? 5.0);

    // Commencement date: use provided startDate if specified, or default to current date in India timezone
    let effectiveStartDate: string;
    if (startDate && typeof startDate === 'string' && startDate.trim()) {
      effectiveStartDate = startDate.trim();
    } else {
      try {
        effectiveStartDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      } catch {
        const d = new Date();
        effectiveStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (!name || !effectiveChitValue || !effectiveMaxMembers || !effectiveTotalMonths) {
      return res.status(400).json({
        success: false,
        message: 'Missing required chit group configuration parameters (name, monthlyInstallment or chitValue, totalMonths, maxMembers)',
      });
    }

    const calculatedInstallment = effectiveInstallment || (effectiveChitValue / effectiveTotalMonths);
    const count = await prisma.chitGroup.count({ where: { companyId } });
    const groupCode = `CG-${2026 + count + 1}`;

    // Each chit group can have at most ONE assigned staff member
    const singleStaffId = assignedStaffId || (Array.isArray(assignedStaffIds) ? assignedStaffIds[0] : null) || (Array.isArray(staffIds) ? staffIds[0] : null) || null;

    const group = await prisma.chitGroup.create({
      data: {
        companyId,
        groupCode,
        name: name.trim(),
        chitValue: effectiveChitValue,
        maxMembers: effectiveMaxMembers,
        totalMonths: effectiveTotalMonths,
        monthlyInstallment: calculatedInstallment,
        foremanCommissionPct: effectiveCommission,
        startDate: effectiveStartDate,
        status: 'ACTIVE',
        assignedStaffId: singleStaffId,
      },
      include: {
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
      },
    });

    // Create single staff assignment if staff member is selected
    if (singleStaffId) {
      await prisma.chitGroupStaff.create({
        data: { groupId: group.id, staffId: singleStaffId },
      });
    }

    // Auto-generate Installment Schedules for all totalMonths
    const [startYear, startMonth, startDay] = effectiveStartDate.split('-').map(Number);
    const scheduleData = [];
    for (let i = 1; i <= effectiveTotalMonths; i++) {
      const dueDate = new Date(startYear, (startMonth - 1) + (i - 1), startDay);
      const dYear = dueDate.getFullYear();
      const dMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
      const dDay = String(dueDate.getDate()).padStart(2, '0');

      scheduleData.push({
        groupId: group.id,
        installmentNo: i,
        dueDate: `${dYear}-${dMonth}-${dDay}`,
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
      include: { members: true, staffAssignments: true },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    // Role check: Staff can only enroll/assign members to their own assigned chit group
    if (req.user?.role === 'COLLECTION_STAFF') {
      const staffUserId = req.user.id;
      const isAssigned =
        group.assignedStaffId === staffUserId ||
        group.staffAssignments.some((sa) => sa.staffId === staffUserId);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Staff can only enroll members into their own assigned chit group.',
        });
      }
    }

    // Prevent duplicate enrollment in the same group
    const alreadyEnrolled = group.members.some((m) => m.subscriberId === subscriberId);
    if (alreadyEnrolled) {
      return res.status(400).json({
        success: false,
        message: 'Member is already enrolled in this chit group.',
      });
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
      include: {
        group: { select: { id: true, groupCode: true, name: true } },
        subscriber: { select: { id: true, fullName: true, subscriberCode: true } },
      },
    });

    // Ensure subscriber is linked to the assigned staff of this group
    const staffToLink = group.assignedStaffId || (req.user?.role === 'COLLECTION_STAFF' ? req.user.id : null);
    if (staffToLink) {
      const existingSub = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { assignedStaffId: true },
      });
      if (existingSub && !existingSub.assignedStaffId) {
        await prisma.subscriber.update({
          where: { id: subscriberId },
          data: { assignedStaffId: staffToLink },
        });
      }
    }

    return res.status(201).json({ success: true, message: `Member assigned successfully to group ${group.name}`, data: membership });
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
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
        staffAssignments: {
          include: {
            staff: { select: { id: true, fullName: true, username: true, phone: true } },
          },
        },
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

    if (req.user?.role === 'COLLECTION_STAFF') {
      const staffUserId = req.user.id;
      const isStaffGroup =
        group.assignedStaffId === staffUserId ||
        group.staffAssignments?.some((sa: any) => sa.staffId === staffUserId);

      if (!isStaffGroup) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Staff can only access chit groups assigned to them.',
        });
      }
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
      assignedStaffId,
      assignedStaffIds,
      staffIds,
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

    // Handle staff assignment (each chit group can have at most ONE assigned staff member)
    const singleStaffId = assignedStaffId !== undefined
      ? (assignedStaffId || null)
      : (Array.isArray(assignedStaffIds) ? (assignedStaffIds[0] || null) : (Array.isArray(staffIds) ? (staffIds[0] || null) : undefined));

    if (assignedStaffIds !== undefined || staffIds !== undefined || assignedStaffId !== undefined) {
      await prisma.chitGroupStaff.deleteMany({ where: { groupId: id } });
      if (singleStaffId) {
        await prisma.chitGroupStaff.create({
          data: { groupId: id, staffId: singleStaffId },
        });
      }
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
        startDate: startDate !== undefined && typeof startDate === 'string' && startDate.trim() ? startDate.trim() : existingGroup.startDate,
        endDate: endDate !== undefined ? endDate : existingGroup.endDate,
        status: status || existingGroup.status,
        ...(singleStaffId !== undefined
          ? { assignedStaffId: singleStaffId || null }
          : {}),
      },
      include: {
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
        staffAssignments: {
          include: {
            staff: { select: { id: true, fullName: true, username: true, phone: true } },
          },
        },
      },
    });

    // If schedules can be refreshed safely when no auctions or transactions have occurred:
    if (
      existingGroup._count.auctions === 0 &&
      existingGroup._count.transactions === 0 &&
      (newTotalMonths !== existingGroup.totalMonths ||
        newChitValue !== existingGroup.chitValue)
    ) {
      await prisma.installmentSchedule.deleteMany({ where: { groupId: id } });
      const [startYear, startMonth, startDay] = updated.startDate.split('-').map(Number);
      const scheduleData = [];
      for (let i = 1; i <= Number(newTotalMonths); i++) {
        const dueDate = new Date(startYear, (startMonth - 1) + (i - 1), startDay);
        const dYear = dueDate.getFullYear();
        const dMonth = String(dueDate.getMonth() + 1).padStart(2, '0');
        const dDay = String(dueDate.getDate()).padStart(2, '0');
        scheduleData.push({
          groupId: id,
          installmentNo: i,
          dueDate: `${dYear}-${dMonth}-${dDay}`,
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

/**
 * Dedicated Endpoint: Assign Staff Member to a Chit Group
 * Multiple staff cannot be assigned to a single chit group (only 1 staff per group).
 * A single staff can still be assigned to multiple chit groups.
 */
export const assignStaffToGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staffIds, assignedStaffId, assignedStaffIds } = req.body;

    const group = await prisma.chitGroup.findUnique({ where: { id } });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    // Multiple staff cannot assign to a single chit group: enforce at most one staff
    const singleStaffId = assignedStaffId !== undefined
      ? (assignedStaffId || null)
      : (Array.isArray(assignedStaffIds) ? (assignedStaffIds[0] || null) : (Array.isArray(staffIds) ? (staffIds[0] || null) : null));

    await prisma.chitGroupStaff.deleteMany({ where: { groupId: id } });
    if (singleStaffId) {
      await prisma.chitGroupStaff.create({
        data: { groupId: id, staffId: singleStaffId },
      });
    }

    const updated = await prisma.chitGroup.update({
      where: { id },
      data: { assignedStaffId: singleStaffId || null },
      include: {
        assignedStaff: { select: { id: true, fullName: true, username: true, phone: true } },
        staffAssignments: {
          include: {
            staff: { select: { id: true, fullName: true, username: true, phone: true } },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: `Staff assigned successfully to chit group ${group.name}`,
      data: updated,
    });
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
