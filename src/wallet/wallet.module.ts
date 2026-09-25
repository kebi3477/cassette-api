import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service.js';

/** 3단계에서 잔액·내역·선물 API를 붙인다. 지금은 원장 기록(WalletService.apply)만 있다 */
@Module({
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
