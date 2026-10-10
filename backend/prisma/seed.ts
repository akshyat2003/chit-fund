import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Chit Fund Management System database...');

  // Create Company
  const company = await prisma.company.upsert({
    where: { code: 'APEX-CHITS' },
    update: {},
    create: {
      code: 'APEX-CHITS',
      name: 'Apex Chit Funds India Pvt Ltd',
      stateRegistrationNo: 'KA/CF/2024/09881',
      address: '100 Feet Road, Indiranagar, Bangalore, Karnataka - 560038',
      phone: '080-45678900',
      email: 'info@apexchits.in',
      status: 'ACTIVE',
    },
  });

  // Create Branch
  const branch = await prisma.branch.upsert({
    where: { code: 'BLR-IND-01' },
    update: {},
    create: {
      companyId: company.id,
      code: 'BLR-IND-01',
      name: 'Indiranagar Branch',
      location: 'Bangalore East',
      phone: '080-45678901',
      status: 'ACTIVE',
    },
  });

  // Passwords
  const superAdminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      companyId: company.id,
      role: 'SUPER_ADMIN',
      username: 'superadmin',
      fullName: 'Vikramaditya Sharma (CTO / Super Admin)',
      phone: '9999999999',
      email: 'admin@apexchits.in',
      passwordHash: superAdminPassword,
      status: 'ACTIVE',
    },
  });

  // Manager
  const manager = await prisma.user.upsert({
    where: { username: 'manager1' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      role: 'MANAGER',
      username: 'manager1',
      fullName: 'Rajesh Nair (Branch Manager)',
      phone: '9888888888',
      email: 'manager.ind@apexchits.in',
      passwordHash: managerPassword,
      status: 'ACTIVE',
    },
  });

  // Collection Staff
  const staff = await prisma.user.upsert({
    where: { username: 'staff1' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      role: 'COLLECTION_STAFF',
      username: 'staff1',
      fullName: 'Karthik Gowda (Field Officer)',
      phone: '9777777777',
      email: 'karthik@apexchits.in',
      passwordHash: staffPassword,
      status: 'ACTIVE',
    },
  });

  // Subscribers
  const sub1 = await prisma.subscriber.upsert({
    where: { subscriberCode: 'SUB-1001' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      assignedStaffId: staff.id,
      subscriberCode: 'SUB-1001',
      fullName: 'Ramesh Kumar',
      phone: '9111111111',
      email: 'ramesh.kumar@gmail.com',
      address: '12, 4th Cross, Indiranagar, Bangalore',
      kycStatus: 'VERIFIED',
      idProofType: 'AADHAAR',
      idProofNumber: '5489-1234-9012',
      nomineeName: 'Sunitha Kumar',
      nomineeRelation: 'Spouse',
      nomineePhone: '9111111112',
    },
  });

  const sub2 = await prisma.subscriber.upsert({
    where: { subscriberCode: 'SUB-1002' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      assignedStaffId: staff.id,
      subscriberCode: 'SUB-1002',
      fullName: 'Suresh Patel',
      phone: '9222222222',
      email: 'suresh.patel@yahoo.com',
      address: '45, HAL 2nd Stage, Bangalore',
      kycStatus: 'VERIFIED',
      idProofType: 'PAN',
      idProofNumber: 'ABCDE1234F',
      nomineeName: 'Meena Patel',
      nomineeRelation: 'Spouse',
      nomineePhone: '9222222223',
    },
  });

  const sub3 = await prisma.subscriber.upsert({
    where: { subscriberCode: 'SUB-1003' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      assignedStaffId: staff.id,
      subscriberCode: 'SUB-1003',
      fullName: 'Anitha Rao',
      phone: '9333333333',
      email: 'anitha.rao@outlook.com',
      address: '88, Domlur Layout, Bangalore',
      kycStatus: 'VERIFIED',
      idProofType: 'AADHAAR',
      idProofNumber: '9876-5432-1098',
      nomineeName: 'Kishore Rao',
      nomineeRelation: 'Brother',
      nomineePhone: '9333333334',
    },
  });

  // Create Active Chit Group
  const chitGroup = await prisma.chitGroup.upsert({
    where: { groupCode: 'CG-500K-20M' },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      groupCode: 'CG-500K-20M',
      name: '5 Lakhs 20 Months Premium Group',
      chitValue: 500000.0,
      maxMembers: 20,
      totalMonths: 20,
      monthlyInstallment: 25000.0,
      foremanCommissionPct: 5.0,
      startDate: '2026-01-01',
      status: 'ACTIVE',
    },
  });

  // Create Schedules
  for (let i = 1; i <= 20; i++) {
    const dueDate = `2026-${String((i % 12) + 1).padStart(2, '0')}-05`;
    await prisma.installmentSchedule.upsert({
      where: {
        groupId_installmentNo: {
          groupId: chitGroup.id,
          installmentNo: i,
        },
      },
      update: {},
      create: {
        groupId: chitGroup.id,
        installmentNo: i,
        dueDate,
        scheduledAmount: 25000.0,
        dividendAmount: i === 1 ? 0 : 1250.0, // Dividend from previous month auction
        netDueAmount: i === 1 ? 25000.0 : 23750.0,
      },
    });
  }

  // Enroll Members
  await prisma.chitGroupMember.upsert({
    where: { groupId_ticketNumber: { groupId: chitGroup.id, ticketNumber: 1 } },
    update: {},
    create: { groupId: chitGroup.id, subscriberId: sub1.id, ticketNumber: 1 },
  });

  await prisma.chitGroupMember.upsert({
    where: { groupId_ticketNumber: { groupId: chitGroup.id, ticketNumber: 2 } },
    update: {},
    create: { groupId: chitGroup.id, subscriberId: sub2.id, ticketNumber: 2 },
  });

  await prisma.chitGroupMember.upsert({
    where: { groupId_ticketNumber: { groupId: chitGroup.id, ticketNumber: 3 } },
    update: {},
    create: { groupId: chitGroup.id, subscriberId: sub3.id, ticketNumber: 3 },
  });

  console.log('Database seeded successfully!');
  console.log('Credentials:');
  console.log('1. Super Admin: username="superadmin", password="admin123"');
  console.log('2. Manager: username="manager1", password="manager123"');
  console.log('3. Field Officer: username="staff1", password="staff123"');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
