import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.company.updateMany({
    data: { name: 'ChitKart' },
  });

  await prisma.user.updateMany({
    where: { username: 'superadmin' },
    data: { email: 'akshyatraj@yahoo.com' },
  });

  await prisma.user.updateMany({
    where: { username: 'manager' },
    data: { email: 'akshyatraj@yahoo.com' },
  });

  const companies = await prisma.company.findMany();
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true },
  });
  console.log('ChitKart database sync completed:', { companies, users });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
