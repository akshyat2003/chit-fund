import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { username: 'superadmin' },
    data: { email: 'harisankarmohanty010@gmail.com' },
  });
  await prisma.user.updateMany({
    where: { username: 'manager' },
    data: { email: 'harisankarmohanty010@gmail.com' },
  });

  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true },
  });
  console.log('Database users updated with email:', users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
