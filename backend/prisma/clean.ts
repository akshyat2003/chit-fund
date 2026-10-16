import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning all tables from database...');

  // 1. Wipe all operational and relational tables
  await prisma.receipt.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.auctionBid.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.installmentSchedule.deleteMany();
  await prisma.chitGroupMember.deleteMany();
  await prisma.chitGroup.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.cashHandover.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // 2. Create the sole Super Admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.user.create({
    data: {
      role: 'SUPER_ADMIN',
      username: 'akshyatraj',
      fullName: 'Akshyatraj Pati',
      phone: '8260521302',
      email: 'akshatrajpati@gmail.com',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log('Database cleanly reset with sole Super Admin:', superAdmin.fullName, superAdmin.phone);
}

clean()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
