import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, MetricsController],
})
export class HealthModule {}
