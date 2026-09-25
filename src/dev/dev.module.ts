import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module.js';
import { ShelfModule } from '../shelf/shelf.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { DevController } from './dev.controller.js';
import { DevService } from './dev.service.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [FriendsModule, ShelfModule, WalletModule],
  controllers: [DevController],
  providers: [DevService, SeedService],
})
export class DevModule {}
