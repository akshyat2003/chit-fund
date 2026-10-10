import { Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { AuthRequest } from '../../middleware/auth.js';

export const createAuctionResult = async (req: AuthRequest, res: Response) => {
  try {
    const {
      groupId,
      installmentNo,
      auctionDate,
      winningBidDiscount, // e.g. 50000.00
      winnerSubscriberId,
      winningTicketNo,
      notes,
    } = req.body;

    if (!groupId || !installmentNo || !auctionDate || winningBidDiscount === undefined || !winnerSubscriberId) {
      return res.status(400).json({ success: false, message: 'Missing required auction details' });
    }

    const group = await prisma.chitGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Chit group not found' });
    }

    // Formula Rules:
    // Foreman Commission = (foremanCommissionPct / 100) * chitValue  e.g. (5 / 100) * 500,000 = 25,000
    // Total Dividend = winningBidDiscount - foremanCommission e.g. 50,000 - 25,000 = 25,000
    // Dividend Per Member = totalDividend / maxMembers e.g. 25,000 / 20 = 1,250

    const foremanCommission = (group.foremanCommissionPct / 100.0) * group.chitValue;
    const totalDividend = Math.max(0, Number(winningBidDiscount) - foremanCommission);
    const dividendPerMember = totalDividend / group.maxMembers;

    // Transaction execution
    const auction = await prisma.$transaction(async (tx) => {
      const newAuction = await tx.auction.create({
        data: {
          groupId,
          installmentNo: Number(installmentNo),
          auctionDate,
          winningBidDiscount: Number(winningBidDiscount),
          foremanCommission,
          totalDividend,
          dividendPerMember,
          winnerSubscriberId,
          winningTicketNo: Number(winningTicketNo || 1),
          status: 'CONFIRMED',
          notes,
        },
      });

      // Update Next Installment Schedule dividend (installmentNo + 1)
      const nextInstallmentNo = Number(installmentNo) + 1;
      const schedule = await tx.installmentSchedule.findUnique({
        where: {
          groupId_installmentNo: {
            groupId,
            installmentNo: nextInstallmentNo,
          },
        },
      });

      if (schedule) {
        await tx.installmentSchedule.update({
          where: { id: schedule.id },
          data: {
            dividendAmount: dividendPerMember,
            netDueAmount: Math.max(0, schedule.scheduledAmount - dividendPerMember),
          },
        });
      }

      // Create Payout Record
      const grossBidAmount = group.chitValue - Number(winningBidDiscount);
      await tx.payout.create({
        data: {
          auctionId: newAuction.id,
          subscriberId: winnerSubscriberId,
          grossBidAmount,
          deductions: 0.0,
          netPayoutAmount: grossBidAmount,
          status: 'PENDING',
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: group.companyId,
          userId: req.user?.id,
          action: 'CONFIRM_AUCTION_RESULT',
          entity: 'Auction',
          entityId: newAuction.id,
          details: JSON.stringify({ groupId, installmentNo, winningBidDiscount, dividendPerMember }),
        },
      });

      return newAuction;
    });

    return res.status(201).json({
      success: true,
      message: 'Auction result recorded and member dividends calculated successfully',
      data: {
        ...auction,
        foremanCommission,
        totalDividend,
        dividendPerMember,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getGroupAuctions = async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const auctions = await prisma.auction.findMany({
      where: { groupId },
      include: {
        winnerSubscriber: { select: { fullName: true, subscriberCode: true, phone: true } },
        payout: true,
      },
      orderBy: { installmentNo: 'asc' },
    });

    return res.json({ success: true, data: auctions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
