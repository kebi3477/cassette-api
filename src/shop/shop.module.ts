import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { ShopController } from './shop.controller.js';
import { ShopService } from './shop.service.js';

@Module({
  imports: [WalletModule, UsersModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
