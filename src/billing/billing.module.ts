import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdmobService } from './admob.service.js';
import { AppStoreService } from './app-store.service.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { GooglePlayService } from './google-play.service.js';

@Module({
  imports: [WalletModule],
  controllers: [BillingController],
  providers: [BillingService, AppStoreService, GooglePlayService, AdmobService],
  exports: [BillingService],
})
export class BillingModule {}
