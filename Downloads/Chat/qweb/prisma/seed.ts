import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@qweb.local' },
    update: {},
    create: {
      email: 'admin@qweb.local',
      username: 'admin',
      displayName: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const room = await prisma.room.create({
    data: {
      type: 'GROUP',
      name: 'general',
      createdById: admin.id,
      memberships: {
        create: [
          {
            userId: admin.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });

  await prisma.message.create({
    data: {
      roomId: room.id,
      senderId: admin.id,
      kind: 'SYSTEM',
      body: 'qweb initialized. Welcome to the new platform.',
    },
  });

  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
