import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

/**
 * Check if the user has access to the specified business:
 * - SUPER_ADMIN: access to all
 * - MANAGER: must be the manager of the business or in same company
 * - COLLECTION_STAFF: must be assigned to the business via BusinessStaff
 */
async function verifyBusinessAccess(userId: string, role: string, businessId: string, companyId?: string | null) {
  if (role === 'SUPER_ADMIN') return true;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      staffAssignments: true,
    },
  });

  if (!business) return false;

  if (role === 'MANAGER') {
    return business.managerId === userId || (companyId && business.companyId === companyId);
  }

  if (role === 'COLLECTION_STAFF') {
    return business.staffAssignments.some((sa) => sa.staffId === userId);
  }

  return false;
}

// ==========================================
// BUSINESS MANAGEMENT
// ==========================================

export const listBusinesses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let whereClause: any = { status: 'ACTIVE' };

    if (role === 'SUPER_ADMIN') {
      if (companyId) whereClause.companyId = companyId;
    } else if (role === 'MANAGER') {
      whereClause.OR = [
        { managerId: userId },
        ...(companyId ? [{ companyId }] : []),
      ];
    } else if (role === 'COLLECTION_STAFF') {
      whereClause.staffAssignments = {
        some: {
          staffId: userId,
        },
      };
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const businesses = await prisma.business.findMany({
      where: whereClause,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            customers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute aggregate metrics for each business
    const businessesWithMetrics = await Promise.all(
      businesses.map(async (b) => {
        const customers = await prisma.khataCustomer.findMany({
          where: { businessId: b.id, status: 'ACTIVE' },
          include: {
            transactions: {
              select: {
                type: true,
                amount: true,
              },
            },
          },
        });

        let totalYouWillGet = 0;
        let totalYouWillGive = 0;

        customers.forEach((cust) => {
          const totalGave = cust.transactions
            .filter((t) => t.type === 'GAVE')
            .reduce((sum, t) => sum + t.amount, 0);
          const totalGot = cust.transactions
            .filter((t) => t.type === 'GOT')
            .reduce((sum, t) => sum + t.amount, 0);

          const net = cust.openingBalance + totalGave - totalGot;
          if (net > 0) {
            totalYouWillGet += net;
          } else if (net < 0) {
            totalYouWillGive += Math.abs(net);
          }
        });

        return {
          id: b.id,
          name: b.name,
          category: b.category,
          phone: b.phone,
          address: b.address,
          currency: b.currency,
          status: b.status,
          createdAt: b.createdAt,
          manager: b.manager,
          staffCount: b.staffAssignments.length,
          staffMembers: b.staffAssignments.map((sa) => sa.staff),
          customerCount: b._count.customers,
          totalYouWillGet,
          totalYouWillGive,
          netBalance: totalYouWillGet - totalYouWillGive,
        };
      })
    );

    res.json({
      success: true,
      data: businessesWithMetrics,
    });
  } catch (error: any) {
    console.error('Error listing businesses:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list businesses' });
  }
};

export const createBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only managers can create businesses' });
    }

    const { name, category, phone, address, currency, staffIds } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Business name is required' });
    }

    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        category: category?.trim() || 'General Store',
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        currency: currency || 'INR',
        companyId: companyId || null,
        managerId: userId,
        ...(Array.isArray(staffIds) && staffIds.length > 0
          ? {
              staffAssignments: {
                create: staffIds.map((sId: string) => ({
                  staffId: sId,
                })),
              },
            }
          : {}),
      },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: business,
    });
  } catch (error: any) {
    console.error('Error creating business:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create business' });
  }
};

export const updateBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const hasAccess = await verifyBusinessAccess(userId!, role!, id, companyId);
    if (!hasAccess || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this business' });
    }

    const { name, category, phone, address, status } = req.body;

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(category !== undefined ? { category: category?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(status ? { status } : {}),
      },
    });

    res.json({
      success: true,
      message: 'Business updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating business:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update business' });
  }
};

export const deleteBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const hasAccess = await verifyBusinessAccess(userId!, role!, id, companyId);
    if (!hasAccess || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this business' });
    }

    await prisma.business.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Business deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting business:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete business' });
  }
};

export const getBusinessStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id: businessId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get all collection staff in company
    const allStaff = await prisma.user.findMany({
      where: {
        role: 'COLLECTION_STAFF',
        status: 'ACTIVE',
        ...(companyId ? { companyId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // Get current assignments for this business
    const assignedStaff = await prisma.businessStaff.findMany({
      where: { businessId },
      select: { staffId: true },
    });

    const assignedSet = new Set(assignedStaff.map((s) => s.staffId));

    const result = allStaff.map((staff) => ({
      ...staff,
      isAssigned: assignedSet.has(staff.id),
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting business staff:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get staff list' });
  }
};

export const assignStaffToBusiness = async (req: AuthRequest, res: Response) => {
  try {
    const { id: businessId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const hasAccess = await verifyBusinessAccess(userId!, role!, businessId, companyId);
    if (!hasAccess || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage staff for this business' });
    }

    const { staffIds } = req.body;
    if (!Array.isArray(staffIds)) {
      return res.status(400).json({ success: false, message: 'staffIds must be an array of user IDs' });
    }

    // Remove existing assignments and replace with new ones
    await prisma.$transaction([
      prisma.businessStaff.deleteMany({
        where: { businessId },
      }),
      ...(staffIds.length > 0
        ? [
            prisma.businessStaff.createMany({
              data: staffIds.map((sId: string) => ({
                businessId,
                staffId: sId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    const updatedAssignments = await prisma.businessStaff.findMany({
      where: { businessId },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Staff assigned successfully',
      data: updatedAssignments.map((a) => a.staff),
    });
  } catch (error: any) {
    console.error('Error assigning staff:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to assign staff' });
  }
};

// ==========================================
// KHATABOOK CUSTOMER MANAGEMENT
// ==========================================

export const listCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const { search, filter } = req.query;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const hasAccess = await verifyBusinessAccess(userId, role, businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this business' });
    }

    let customerWhere: any = {
      businessId,
      status: 'ACTIVE',
    };

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      customerWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.khataCustomer.findMany({
      where: customerWhere,
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let totalYouWillGet = 0;
    let totalYouWillGive = 0;

    const formattedCustomers = await Promise.all(
      customers.map(async (c) => {
        // Aggregate all transactions for this customer
        const allTxs = await prisma.khataTransaction.findMany({
          where: { customerId: c.id },
          select: { type: true, amount: true, transactionDate: true },
          orderBy: { transactionDate: 'desc' },
        });

        const totalGave = allTxs
          .filter((t) => t.type === 'GAVE')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalGot = allTxs
          .filter((t) => t.type === 'GOT')
          .reduce((sum, t) => sum + t.amount, 0);

        // netBalance: > 0 means customer owes shop ("You will get")
        // < 0 means shop owes customer ("You will give")
        const netBalance = c.openingBalance + totalGave - totalGot;

        if (netBalance > 0) {
          totalYouWillGet += netBalance;
        } else if (netBalance < 0) {
          totalYouWillGive += Math.abs(netBalance);
        }

        const lastTx = allTxs[0] || null;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          openingBalance: c.openingBalance,
          totalGave,
          totalGot,
          netBalance,
          status: c.status,
          txCount: c._count.transactions,
          createdBy: c.createdBy
            ? {
                id: c.createdBy.id,
                fullName: c.createdBy.fullName,
                phone: c.createdBy.phone,
                role: c.createdBy.role,
              }
            : null,
          lastTransaction: lastTx
            ? {
                type: lastTx.type,
                amount: lastTx.amount,
                date: lastTx.transactionDate,
              }
            : null,
          updatedAt: c.updatedAt,
        };
      })
    );

    // Apply filter if specified
    let filteredList = formattedCustomers;
    if (filter === 'YOU_WILL_GET') {
      filteredList = formattedCustomers.filter((c) => c.netBalance > 0);
    } else if (filter === 'YOU_WILL_GIVE') {
      filteredList = formattedCustomers.filter((c) => c.netBalance < 0);
    } else if (filter === 'SETTLED') {
      filteredList = formattedCustomers.filter((c) => c.netBalance === 0);
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalYouWillGet,
          totalYouWillGive,
          netBalance: totalYouWillGet - totalYouWillGive,
          totalCustomers: customers.length,
        },
        customers: filteredList,
      },
    });
  } catch (error: any) {
    console.error('Error listing customers:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list customers' });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const hasAccess = await verifyBusinessAccess(userId, role, businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this business' });
    }

    const { name, phone, address, openingBalance, openingType } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    let rawOpening = Number(openingBalance) || 0;
    // If openingType is 'YOU_WILL_GIVE', negative opening balance
    if (openingType === 'YOU_WILL_GIVE') {
      rawOpening = -Math.abs(rawOpening);
    } else {
      rawOpening = Math.abs(rawOpening);
    }

    const customer = await prisma.khataCustomer.create({
      data: {
        businessId,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        openingBalance: rawOpening,
        createdById: userId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Customer added successfully',
      data: customer,
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to add customer' });
  }
};

export const getCustomerDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const customer = await prisma.khataCustomer.findUnique({
      where: { id: customerId },
      include: {
        business: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
        transactions: {
          include: {
            recordedBy: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
          orderBy: { transactionDate: 'desc' },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const hasAccess = await verifyBusinessAccess(userId!, role!, customer.businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this business' });
    }

    // Calculate running balances
    let totalGave = 0;
    let totalGot = 0;

    customer.transactions.forEach((tx) => {
      if (tx.type === 'GAVE') totalGave += tx.amount;
      if (tx.type === 'GOT') totalGot += tx.amount;
    });

    const netBalance = customer.openingBalance + totalGave - totalGot;

    res.json({
      success: true,
      data: {
        ...customer,
        totalGave,
        totalGot,
        netBalance,
      },
    });
  } catch (error: any) {
    console.error('Error getting customer details:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get customer details' });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const customer = await prisma.khataCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const hasAccess = await verifyBusinessAccess(userId!, role!, customer.businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, phone, address } = req.body;

    const updated = await prisma.khataCustomer.update({
      where: { id: customerId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
      },
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update customer' });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const customer = await prisma.khataCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const hasAccess = await verifyBusinessAccess(userId!, role!, customer.businessId, companyId);
    if (!hasAccess || (role !== 'MANAGER' && role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'Only managers can delete customers' });
    }

    await prisma.khataCustomer.delete({
      where: { id: customerId },
    });

    res.json({
      success: true,
      message: 'Customer and ledger history deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete customer' });
  }
};

// ==========================================
// KHATABOOK TRANSACTIONS (YOU GAVE / YOU GOT)
// ==========================================

export const addTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const customer = await prisma.khataCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const hasAccess = await verifyBusinessAccess(userId, role, customer.businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { type, amount, description, billPhoto, paymentMode, transactionDate } = req.body;

    if (type !== 'GAVE' && type !== 'GOT') {
      return res.status(400).json({ success: false, message: "Transaction type must be 'GAVE' (Maine Diye) or 'GOT' (Mujhe Mile)" });
    }

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Transaction amount must be greater than zero' });
    }

    const tx = await prisma.khataTransaction.create({
      data: {
        customerId,
        type,
        amount: parsedAmount,
        description: description?.trim() || null,
        billPhoto: billPhoto || null,
        paymentMode: paymentMode || 'CASH',
        recordedByUserId: userId,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    // Update customer updatedAt
    await prisma.khataCustomer.update({
      where: { id: customerId },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({
      success: true,
      message: type === 'GAVE' ? 'Recorded credit given (Maine Diye)' : 'Recorded payment received (Mujhe Mile)',
      data: tx,
    });
  } catch (error: any) {
    console.error('Error adding transaction:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record transaction' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { txId } = req.params;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    const tx = await prisma.khataTransaction.findUnique({
      where: { id: txId },
      include: {
        customer: true,
      },
    });

    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const hasAccess = await verifyBusinessAccess(userId!, role!, tx.customer.businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only manager or the staff who recorded it can delete
    if (role !== 'MANAGER' && role !== 'SUPER_ADMIN' && tx.recordedByUserId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the creator or manager can delete this transaction' });
    }

    await prisma.khataTransaction.delete({
      where: { id: txId },
    });

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete transaction' });
  }
};

// ==========================================
// BUSINESS CASHFLOW & STAFF MONITORING
// ==========================================

export const getBusinessCashflowAndStaffMonitoring = async (req: AuthRequest, res: Response) => {
  try {
    const { businessId } = req.params;
    const { period, startDate, endDate, staffId } = req.query;
    const userId = req.user?.id;
    const role = req.user?.role;
    const companyId = req.user?.companyId;

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const hasAccess = await verifyBusinessAccess(userId, role, businessId, companyId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this business' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    // Build Date Filter
    let dateWhere: any = {};
    const now = new Date();
    const periodStr = String(period || '30DAYS').toUpperCase();

    if (periodStr === 'TODAY' || periodStr === 'DAILY') {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      dateWhere = { gte: from };
    } else if (periodStr === '7DAYS' || periodStr === 'WEEKLY') {
      const from = new Date();
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      dateWhere = { gte: from };
    } else if (periodStr === '30DAYS' || periodStr === 'MONTH') {
      const from = new Date();
      from.setDate(now.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      dateWhere = { gte: from };
    } else if (periodStr === 'CUSTOM' && startDate && endDate) {
      const from = new Date(startDate as string);
      from.setHours(0, 0, 0, 0);
      const to = new Date(endDate as string);
      to.setHours(23, 59, 59, 999);
      dateWhere = { gte: from, lte: to };
    }

    // Query all transactions for this business
    const txWhere: any = {
      customer: {
        businessId,
      },
      ...(Object.keys(dateWhere).length > 0 ? { transactionDate: dateWhere } : {}),
      ...(staffId && typeof staffId === 'string' ? { recordedByUserId: staffId } : {}),
    };

    const transactions = await prisma.khataTransaction.findMany({
      where: txWhere,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Summary calculations
    let totalCashIn = 0; // GOT (customer payment)
    let totalCashOut = 0; // GAVE (credit given)
    let cashPayments = 0;
    let digitalPayments = 0;

    const dailyMap: Record<string, { date: string; cashIn: number; cashOut: number; netFlow: number; count: number }> = {};

    transactions.forEach((tx) => {
      const amt = tx.amount;
      const dayKey = new Date(tx.transactionDate).toISOString().split('T')[0];

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, cashIn: 0, cashOut: 0, netFlow: 0, count: 0 };
      }
      dailyMap[dayKey].count += 1;

      if (tx.type === 'GOT') {
        totalCashIn += amt;
        dailyMap[dayKey].cashIn += amt;
        dailyMap[dayKey].netFlow += amt;
        if (tx.paymentMode === 'CASH') cashPayments += amt;
        else digitalPayments += amt;
      } else {
        totalCashOut += amt;
        dailyMap[dayKey].cashOut += amt;
        dailyMap[dayKey].netFlow -= amt;
      }
    });

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    // Staff Performance & Monitoring Roster
    const staffRoster = await Promise.all(
      business.staffAssignments.map(async (sa) => {
        const staffUser = sa.staff;

        // Count customers enrolled by this staff member in this shop
        const customersEnrolled = await prisma.khataCustomer.count({
          where: {
            businessId,
            createdById: staffUser.id,
          },
        });

        // Sum transactions recorded by this staff member in this shop
        const staffTxs = await prisma.khataTransaction.findMany({
          where: {
            customer: { businessId },
            recordedByUserId: staffUser.id,
            ...(Object.keys(dateWhere).length > 0 ? { transactionDate: dateWhere } : {}),
          },
          select: {
            type: true,
            amount: true,
            transactionDate: true,
          },
          orderBy: { transactionDate: 'desc' },
        });

        const staffCashIn = staffTxs
          .filter((t) => t.type === 'GOT')
          .reduce((sum, t) => sum + t.amount, 0);

        const staffCreditGiven = staffTxs
          .filter((t) => t.type === 'GAVE')
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          id: staffUser.id,
          fullName: staffUser.fullName,
          phone: staffUser.phone,
          role: staffUser.role,
          customersEnrolled,
          cashInCollected: staffCashIn,
          creditGiven: staffCreditGiven,
          netHandled: staffCashIn - staffCreditGiven,
          totalTransactions: staffTxs.length,
          lastActivity: staffTxs[0]?.transactionDate || null,
        };
      })
    );

    res.json({
      success: true,
      data: {
        business: {
          id: business.id,
          name: business.name,
          category: business.category,
          phone: business.phone,
          address: business.address,
        },
        summary: {
          totalCashIn,
          totalCashOut,
          netCashflow: totalCashIn - totalCashOut,
          cashPayments,
          digitalPayments,
          totalTransactions: transactions.length,
        },
        staffRoster,
        dailyBreakdown,
        transactions,
      },
    });
  } catch (error: any) {
    console.error('Error in getBusinessCashflowAndStaffMonitoring:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get cashflow and staff monitoring' });
  }
};
