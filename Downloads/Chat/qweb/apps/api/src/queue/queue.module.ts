import { Global, Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { MessageQueueService } from './message-queue.service';
import { NotificationService } from './notification.service';
import { EventBusService } from './event-bus.service';
import { NotificationsController } from './notifications.controller';
import { CacheService } from '@/common/services/cache.service';
import { ShardingService } from '@/common/services/sharding.service';
import { ConnectionManagerService } from '@/common/services/connection-manager.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    MessageQueueService,
    NotificationService,
    EventBusService,
    CacheService,
    ShardingService,
    ConnectionManagerService,
  ],
  exports: [
    MessageQueueService,
    NotificationService,
    EventBusService,
    CacheService,
    ShardingService,
    ConnectionManagerService,
  ],
})
export class QueueModule {}
