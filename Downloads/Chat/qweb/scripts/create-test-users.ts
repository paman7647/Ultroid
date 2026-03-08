import { PrismaClient, MembershipRole, MessageKind, RoomType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function ensureUser(params: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  bio: string;
  statusMessage: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);
  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      username: params.username,
      displayName: params.displayName,
      passwordHash,
      bio: params.bio,
      statusMessage: params.statusMessage,
      lastSeenAt: new Date(),
      hideLastSeen: false,
      hideProfilePhoto: false,
    },
    update: {
      username: params.username,
      displayName: params.displayName,
      passwordHash,
      bio: params.bio,
      statusMessage: params.statusMessage,
      lastSeenAt: new Date(),
      hideLastSeen: false,
      hideProfilePhoto: false,
    },
  });
}

async function ensureDmRoom(userA: string, userB: string) {
  const candidates = await prisma.room.findMany({
    where: {
      type: RoomType.DM,
      memberships: {
        some: { userId: userA },
      },
    },
    include: {
      memberships: true,
    },
  });

  const existing = candidates.find(
    (room) =>
      room.memberships.length === 2 &&
      room.memberships.some((m) => m.userId === userA) &&
      room.memberships.some((m) => m.userId === userB),
  );

  if (existing) return existing;

  return prisma.room.create({
    data: {
      type: RoomType.DM,
      createdById: userA,
      memberships: {
        create: [
          { userId: userA, role: MembershipRole.OWNER },
          { userId: userB, role: MembershipRole.MEMBER },
        ],
      },
    },
    include: { memberships: true },
  });
}

async function ensureGroupRoom(ownerId: string, memberId: string) {
  const name = 'Production Test Group';
  const existing = await prisma.room.findFirst({
    where: {
      type: RoomType.GROUP,
      name,
      createdById: ownerId,
    },
  });

  if (existing) {
    await prisma.roomMembership.upsert({
      where: { roomId_userId: { roomId: existing.id, userId: ownerId } },
      create: { roomId: existing.id, userId: ownerId, role: MembershipRole.OWNER },
      update: { role: MembershipRole.OWNER },
    });
    await prisma.roomMembership.upsert({
      where: { roomId_userId: { roomId: existing.id, userId: memberId } },
      create: { roomId: existing.id, userId: memberId, role: MembershipRole.ADMIN },
      update: { role: MembershipRole.ADMIN },
    });
    return existing;
  }

  return prisma.room.create({
    data: {
      type: RoomType.GROUP,
      name,
      description: 'Shared room for end-to-end production checks',
      createdById: ownerId,
      announcementMode: false,
      slowModeSeconds: 0,
      memberships: {
        create: [
          { userId: ownerId, role: MembershipRole.OWNER },
          { userId: memberId, role: MembershipRole.ADMIN },
        ],
      },
    },
  });
}

async function ensureMessage(roomId: string, senderId: string, body: string) {
  const existing = await prisma.message.findFirst({
    where: { roomId, senderId, body, deletedAt: null },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.message.create({
    data: {
      roomId,
      senderId,
      kind: MessageKind.TEXT,
      body,
    },
    select: { id: true, createdAt: true },
  });

  await prisma.room.update({
    where: { id: roomId },
    data: { lastMessageAt: created.createdAt },
  });

  return created.id;
}

async function main() {
  const eve = await ensureUser({
    email: 'eve.test@qweb.local',
    username: 'eve_test',
    displayName: 'Eve Tester',
    password: 'EveTest#2026!',
    bio: 'Security and QA test account',
    statusMessage: 'Testing all features',
  });

  const adam = await ensureUser({
    email: 'adam.test@qweb.local',
    username: 'adam_test',
    displayName: 'Adam Tester',
    password: 'AdamTest#2026!',
    bio: 'Realtime and media test account',
    statusMessage: 'Online for test runs',
  });

  await prisma.userBlock.deleteMany({
    where: {
      OR: [
        { blockerId: eve.id, blockedId: adam.id },
        { blockerId: adam.id, blockedId: eve.id },
      ],
    },
  });

  await prisma.userContact.upsert({
    where: { ownerId_contactUserId: { ownerId: eve.id, contactUserId: adam.id } },
    create: { ownerId: eve.id, contactUserId: adam.id, isFavorite: true },
    update: { isFavorite: true },
  });
  await prisma.userContact.upsert({
    where: { ownerId_contactUserId: { ownerId: adam.id, contactUserId: eve.id } },
    create: { ownerId: adam.id, contactUserId: eve.id, isFavorite: true },
    update: { isFavorite: true },
  });

  const dm = await ensureDmRoom(eve.id, adam.id);
  const group = await ensureGroupRoom(eve.id, adam.id);

  for (const roomId of [dm.id, group.id]) {
    await prisma.userChatState.upsert({
      where: { userId_roomId: { userId: eve.id, roomId } },
      create: { userId: eve.id, roomId, isPinned: true, pinOrder: 1 },
      update: { isPinned: true },
    });
    await prisma.userChatState.upsert({
      where: { userId_roomId: { userId: adam.id, roomId } },
      create: { userId: adam.id, roomId },
      update: {},
    });
  }

  const eveMsgId = await ensureMessage(dm.id, eve.id, 'Hi Adam, this DM is ready for production testing.');
  const adamMsgId = await ensureMessage(dm.id, adam.id, 'Great, I can test reactions, edits, and read receipts now.');

  await prisma.messageReaction.createMany({
    data: [
      { messageId: eveMsgId, userId: adam.id, emoji: '👍' },
      { messageId: adamMsgId, userId: eve.id, emoji: '🔥' },
    ],
    skipDuplicates: true,
  });

  await prisma.starredMessage.createMany({
    data: [
      { userId: eve.id, messageId: adamMsgId },
      { userId: adam.id, messageId: eveMsgId },
    ],
    skipDuplicates: true,
  });

  await prisma.roomInvite.createMany({
    data: [
      {
        roomId: group.id,
        createdById: eve.id,
        code: 'prodtestinvite1',
        maxUses: 50,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Created/updated test users:');
  console.log(`- Eve: eve.test@qweb.local / EveTest#2026!`);
  console.log(`- Adam: adam.test@qweb.local / AdamTest#2026!`);
  console.log(`DM Room ID: ${dm.id}`);
  console.log(`Group Room ID: ${group.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
