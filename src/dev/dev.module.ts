import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module.js';
import { DevController } from './dev.controller.js';
import { DevService } from './dev.service.js';

@Module({
  imports: [FriendsModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
