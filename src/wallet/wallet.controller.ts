import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import {
  type AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator.js';
import { Idempotent } from '../common/decorators/idempotent.decorator.js';
import { CreateGiftDto } from './dto/create-gift.dto.js';
import { ListLedgerDto } from './dto/list-ledger.dto.js';
import type {
  LedgerEntryResponse,
  WalletResponse,
} from './dto/wallet.response.js';
import { WalletService } from './wallet.service.js';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /** 잔액 + 오늘 남은 광고 */
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<WalletResponse> {
    return this.walletService.getWallet(user.id);
  }

  /** 크레딧 내역 (최신이 앞) */
  @Get('ledger')
  ledger(
    @CurrentUser() user: AuthUser,
    @Query() q: ListLedgerDto,
  ): Promise<{ items: LedgerEntryResponse[]; nextCursor: string | null }> {
    return this.walletService.listLedger(user.id, q.cursor, q.limit);
  }

  /** 크레딧 선물 */
  @Post('gifts')
  @Idempotent()
  gift(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGiftDto,
    @Headers('idempotency-key') key: string,
  ): Promise<{ credits: number; entry: LedgerEntryResponse }> {
    return this.walletService.gift(user.id, dto.toUserId, dto.amount, key);
  }
}
