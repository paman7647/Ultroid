import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KeyAlgorithm } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PublishKeyDto, CreateSessionDto } from './dto/encryption.dto';

@Injectable()
export class EncryptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish a public key (identity key, signed pre-key, or one-time pre-key).
   * Identity keys are unique per user+device+algorithm.
   */
  async publishKey(userId: string, dto: PublishKeyDto) {
    const algorithm = dto.algorithm as unknown as KeyAlgorithm;

    // For identity keys, upsert to ensure one per user+device+algorithm
    if (dto.isIdentity) {
      const existing = await this.prisma.encryptionKey.findFirst({
        where: {
          userId,
          deviceId: dto.deviceId ?? null,
          algorithm,
          isIdentity: true,
        },
      });

      if (existing) {
        return this.prisma.encryptionKey.update({
          where: { id: existing.id },
          data: {
            publicKey: dto.publicKey,
            signature: dto.signature,
          },
        });
      }
    }

    return this.prisma.encryptionKey.create({
      data: {
        userId,
        deviceId: dto.deviceId,
        algorithm,
        publicKey: dto.publicKey,
        isIdentity: dto.isIdentity ?? false,
        isOneTime: dto.isOneTime ?? false,
        signature: dto.signature,
      },
    });
  }

  /**
   * Publish a batch of one-time pre-keys.
   */
  async publishPreKeys(
    userId: string,
    algorithm: KeyAlgorithm,
    keys: Array<{ publicKey: string; signature?: string }>,
    deviceId?: string,
  ) {
    const data = keys.map((key) => ({
      userId,
      deviceId: deviceId ?? null,
      algorithm,
      publicKey: key.publicKey,
      isIdentity: false,
      isOneTime: true,
      signature: key.signature ?? null,
    }));

    await this.prisma.encryptionKey.createMany({ data });
    return { published: data.length };
  }

  /**
   * Fetch public keys for a user: identity key + one available one-time pre-key.
   * The one-time pre-key is marked as used (consumed) atomically.
   */
  async fetchKeyBundle(userId: string, deviceId?: string) {
    const whereDevice = deviceId ? { deviceId } : {};

    // Get identity key
    const identityKey = await this.prisma.encryptionKey.findFirst({
      where: {
        userId,
        isIdentity: true,
        ...whereDevice,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get signed pre-key (non-identity, non-one-time)
    const signedPreKey = await this.prisma.encryptionKey.findFirst({
      where: {
        userId,
        isIdentity: false,
        isOneTime: false,
        ...whereDevice,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Consume one one-time pre-key
    const oneTimePreKey = await this.prisma.encryptionKey.findFirst({
      where: {
        userId,
        isOneTime: true,
        isUsed: false,
        ...whereDevice,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (oneTimePreKey) {
      await this.prisma.encryptionKey.update({
        where: { id: oneTimePreKey.id },
        data: { isUsed: true },
      });
    }

    return {
      userId,
      deviceId: deviceId ?? null,
      identityKey: identityKey
        ? {
            id: identityKey.id,
            algorithm: identityKey.algorithm,
            publicKey: identityKey.publicKey,
            signature: identityKey.signature,
          }
        : null,
      signedPreKey: signedPreKey
        ? {
            id: signedPreKey.id,
            algorithm: signedPreKey.algorithm,
            publicKey: signedPreKey.publicKey,
            signature: signedPreKey.signature,
          }
        : null,
      oneTimePreKey: oneTimePreKey
        ? {
            id: oneTimePreKey.id,
            algorithm: oneTimePreKey.algorithm,
            publicKey: oneTimePreKey.publicKey,
          }
        : null,
    };
  }

  /**
   * Get count of remaining one-time pre-keys for a user.
   */
  async getPreKeyCount(userId: string, deviceId?: string) {
    const count = await this.prisma.encryptionKey.count({
      where: {
        userId,
        isOneTime: true,
        isUsed: false,
        ...(deviceId ? { deviceId } : {}),
      },
    });
    return { count };
  }

  /**
   * Create or update an encryption session between two users.
   * Used for double ratchet session persistence.
   */
  async createSession(userId: string, dto: CreateSessionDto) {
    return this.prisma.encryptionSession.upsert({
      where: {
        initiatorUserId_responderUserId_initiatorDeviceId_responderDeviceId: {
          initiatorUserId: userId,
          responderUserId: dto.responderUserId,
          initiatorDeviceId: dto.initiatorDeviceId ?? '',
          responderDeviceId: dto.responderDeviceId ?? '',
        },
      },
      create: {
        initiatorUserId: userId,
        responderUserId: dto.responderUserId,
        initiatorDeviceId: dto.initiatorDeviceId,
        responderDeviceId: dto.responderDeviceId,
        sessionData: dto.sessionData,
      },
      update: {
        sessionData: dto.sessionData,
        chainIndex: { increment: 1 },
      },
    });
  }

  /**
   * Get an existing session between two users.
   */
  async getSession(userId: string, peerUserId: string, deviceId?: string) {
    // Check both directions (initiator or responder)
    const session = await this.prisma.encryptionSession.findFirst({
      where: {
        OR: [
          {
            initiatorUserId: userId,
            responderUserId: peerUserId,
            ...(deviceId ? { initiatorDeviceId: deviceId } : {}),
          },
          {
            initiatorUserId: peerUserId,
            responderUserId: userId,
            ...(deviceId ? { responderDeviceId: deviceId } : {}),
          },
        ],
      },
    });

    if (!session) throw new NotFoundException('No encryption session found');
    return session;
  }

  /**
   * List all devices with published keys for a user.
   */
  async listUserDeviceKeys(userId: string) {
    const keys = await this.prisma.encryptionKey.findMany({
      where: { userId, isIdentity: true },
      include: {
        device: {
          select: { id: true, name: true, platform: true, lastSeenAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      keyId: k.id,
      algorithm: k.algorithm,
      publicKey: k.publicKey,
      device: k.device,
      createdAt: k.createdAt,
    }));
  }
}
