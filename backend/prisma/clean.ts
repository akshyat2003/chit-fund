import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning all existing data from database...');

  // Delete all dependent transactional and operational records
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

  console.log('All previous records wiped clean successfully.');

  // Create ChitKart Company
  const company = await prisma.company.create({
    data: {
      code: 'CHITKART-01',
      name: 'ChitKart',
      status: 'ACTIVE',
    },
  });

  // Create Head Office Branch
  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      code: 'HQ-01',
      name: 'ChitKart Head Office',
      status: 'ACTIVE',
    },
  });

  // Password: admin123
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Create Sole Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      role: 'SUPER_ADMIN',
      username: 'akshyatraj',
      fullName: 'Akshyatraj Pati',
      phone: '8260521302',
      email: 'akshatrajpati@gmail.com',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log('Database cleanly reset with Super Admin:');
  console.log({
    id: superAdmin.id,
    fullName: superAdmin.fullName,
    phone: superAdmin.phone,
    email: superAdmin.email,
    username: superAdmin.username,
    role: superAdmin.role,
    company: company.name,
  });
  console.log('Login credentials:');
  console.log('  Username/Email/Phone: "akshyatraj" OR "8260521302" OR "akshatrajpati@gmail.com"');
  console.log('  Password: "admin123"');
}

clean()
  .catch((e) => {
    console.error('Error during database cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
