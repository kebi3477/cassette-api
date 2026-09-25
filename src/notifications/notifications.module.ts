import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
