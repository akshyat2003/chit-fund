import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning all dummy records from database...');

  // Delete dependent transactional data first
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
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();

  console.log('All dummy data cleared successfully!');

  // Create clean initial Master Company, Branch & Admin User
  const company = await prisma.company.create({
    data: {
      code: 'CHIT-CORP-01',
      name: 'Chit Fund Management Co.',
      status: 'ACTIVE',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: 'BR-001',
      name: 'Main Head Branch',
      status: 'ACTIVE',
    },
  });

  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  // Super Admin
  await prisma.user.create({
    data: {
      companyId: company.id,
      role: 'SUPER_ADMIN',
      username: 'superadmin',
      fullName: 'System Administrator',
      phone: '9999999999',
      passwordHash: adminPassword,
      status: 'ACTIVE',
    },
  });

  // Admin / Branch Manager
  await prisma.user.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      role: 'MANAGER',
      username: 'manager',
      fullName: 'Branch Manager',
      phone: '9888888888',
      passwordHash: managerPassword,
      status: 'ACTIVE',
    },
  });

  console.log('Clean setup complete! Ready for manual data entry.');
  console.log('Admin login: username="superadmin", password="admin123"');
  console.log('Manager login: username="manager", password="manager123"');
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
