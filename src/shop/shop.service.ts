import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import type { MeResponse } from '../users/dto/me.response.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { LedgerEntryResponse } from '../wallet/dto/wallet.response.js';
import { toLedgerEntry, WalletService } from '../wallet/wallet.service.js';
import {
  CREDIT_PACKS,
  DRAWER_PRODUCTS,
  GIFT_AMOUNTS,
  LedgerReasons,
  TAPE_PRODUCTS,
} from './products.js';

export interface PurchaseResponse {
  credits: number;
  tapes: MeResponse['tapes'];
  drawer: MeResponse['drawer'];
  entry: LedgerEntryResponse;
}

@Injectable()
export class ShopService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly users: UsersService,
  ) {}

  products() {
    return {
      tapes: TAPE_PRODUCTS,
      drawer: DRAWER_PRODUCTS,
      creditPacks: CREDIT_PACKS,
      giftAmounts: [...GIFT_AMOUNTS],
    };
  }

  /**
   * 크레딧으로 사기. 한 트랜잭션에서 조건부 차감(모자라면 402 + need) → 테이프 추가 또는 서랍 +10.
   */
  async purchase(
    userId: string,
    productId: string,
    idempotencyKey: string | null,
  ): Promise<PurchaseResponse> {
    const tape = TAPE_PRODUCTS.find((p) => p.id === productId);
    const drawer = DRAWER_PRODUCTS.find((p) => p.id === productId);
    if (!tape && !drawer) throw new AppException('PRODUCT_NOT_FOUND');

    const entry = await this.dataSource.transaction(async (m) => {
      const product = (tape ?? drawer)!;
      const entry = await this.wallet.apply(m, {
        userId,
        delta: -product.price,
        kind: tape ? 'tape_purchase' : 'drawer_expand',
        reason: tape
          ? LedgerReasons.tapePurchase(tape)
          : LedgerReasons.drawerExpand,
        idempotencyKey,
      });
      if (tape) {
        await m.query(
          `INSERT INTO tape_inventory (user_id, tape_type, qty) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, tape_type) DO UPDATE SET qty = tape_inventory.qty + EXCLUDED.qty`,
          [userId, tape.tapeType, tape.qty],
        );
      } else {
        await m
          .createQueryBuilder()
          .update(User)
          .set({ drawerCap: () => `drawer_cap + ${drawer!.slots}` })
          .where('id = :userId', { userId })
          .execute();
      }
      return entry;
    });

    const me = await this.users.getMe(userId);
    return {
      credits: me.credits,
      tapes: me.tapes,
      drawer: me.drawer,
      entry: toLedgerEntry(entry),
    };
  }
}
