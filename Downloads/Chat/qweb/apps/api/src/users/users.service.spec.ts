import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('returns empty results for short search query', async () => {
    const prisma = {} as any;
    const service = new UsersService(prisma);

    await expect(service.searchUsers('u1', 'a')).resolves.toEqual([]);
  });

  it('rejects blocking self', async () => {
    const prisma = {
      user: { findUnique: jest.fn() },
      userBlock: { upsert: jest.fn() },
    } as any;
    const service = new UsersService(prisma);

    await expect(service.blockUser('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
