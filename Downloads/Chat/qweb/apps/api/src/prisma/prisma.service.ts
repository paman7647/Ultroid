import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit() {
    // Log slow queries in production
    (this as any).$on('query', (e: any) => {
      if (e.duration > 200) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query?.substring(0, 200)}`);
      }
    });

    (this as any).$on('error', (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });

    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async enableShutdownHooks(_app: INestApplication) {
    // Prisma library engine no longer supports beforeExit hooks.
    // Process-level shutdown is handled in main.ts.
    return;
  }
}
