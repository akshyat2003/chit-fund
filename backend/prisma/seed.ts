import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'akshyatraj' },
    update: {},
    create: {
      role: 'SUPER_ADMIN',
      username: 'akshyatraj',
      fullName: 'Akshyatraj Pati',
      phone: '8260521302',
      email: 'akshatrajpati@gmail.com',
      passwordHash,
      status: 'ACTIVE',
    },
  });
  console.log('Seed completed: Akshyatraj Pati Super Admin configured.');
}

main().finally(() => prisma.$disconnect());
