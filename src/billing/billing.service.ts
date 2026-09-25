import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { findCreditPack, LedgerReasons } from '../shop/products.js';
import { User } from '../users/entities/user.entity.js';
import type { LedgerEntryResponse } from '../wallet/dto/wallet.response.js';
import { CreditLedger } from '../wallet/entities/credit-ledger.entity.js';
import { toLedgerEntry, WalletService } from '../wallet/wallet.service.js';
import { AdmobService } from './admob.service.js';
import { AppStoreService } from './app-store.service.js';
import { VerifyIapDto } from './dto/verify-iap.dto.js';
import { BillingEvent } from './entities/billing-event.entity.js';
import { IapPurchase, IapStore } from './entities/iap-purchase.entity.js';
import { GooglePlayService } from './google-play.service.js';

export interface IapResponse {
  credits: number;
  granted: number;
  /** 이미 처리한 결제를 다시 보냈으면 true (지급 없음) */
  alreadyProcessed: boolean;
  entry: LedgerEntryResponse | null;
}

/** 환불로 이어지는 App Store 알림 */
const APPLE_REFUND_TYPES = new Set(['REFUND', 'REVOKE']);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly appStore: AppStoreService,
    private readonly play: GooglePlayService,
    private readonly admob: AdmobService,
  ) {}

  /**
   * 인앱 결제 확인 → 크레딧 충전.
   * 스토어에서 검증한 거래 id로 iap_purchases에 넣고(UNIQUE), 처음일 때만 지급한다.
   */
  async verifyIap(userId: string, dto: VerifyIapDto): Promise<IapResponse> {
    const pack = findCreditPack(dto.productId);
    if (!pack) throw new AppException('PRODUCT_NOT_FOUND');

    let transactionId: string;
    let environment: string | null = null;
    let purchaseToken: string | null = null;
    if (dto.store === 'app_store') {
      if (!this.appStore.available()) throw new AppException('IAP_UNAVAILABLE');
      const t = await this.appStore.verifyTransaction(dto.verificationData);
      if (t.productId !== pack.productId || t.revoked)
        throw new AppException('RECEIPT_INVALID');
      transactionId = t.transactionId;
      environment = t.environment;
    } else {
      if (!this.play.available()) throw new AppException('IAP_UNAVAILABLE');
      const p = await this.play.getProductPurchase(
        pack.productId,
        dto.verificationData,
      );
      if (p.purchaseState === 2) throw new AppException('RECEIPT_PENDING');
      if (p.purchaseState !== 0) throw new AppException('RECEIPT_INVALID');
      transactionId = p.orderId;
      purchaseToken = dto.verificationData;
    }

    const result = await this.dataSource.transaction(async (m) => {
      const inserted = await m
        .createQueryBuilder()
        .insert()
        .into(IapPurchase)
        .values({
          store: dto.store,
          transactionId,
          productId: pack.productId,
          userId,
          credits: pack.credits,
          purchaseToken,
          environment,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const newId = (inserted.raw as { id: string }[])[0]?.id;

      if (!newId) {
        const existing = await m.findOneByOrFail(IapPurchase, {
          store: dto.store,
          transactionId,
        });
        if (existing.userId !== userId)
          throw new AppException('RECEIPT_ALREADY_USED');
        const user = await m.findOneByOrFail(User, { id: userId });
        const entry = await m.findOneBy(CreditLedger, {
          userId,
          refId: existing.id,
          kind: 'iap',
        });
        return {
          credits: user.credits,
          granted: 0,
          alreadyProcessed: true,
          entry: entry ? toLedgerEntry(entry) : null,
        };
      }
      const entry = await this.wallet.apply(m, {
        userId,
        delta: pack.credits,
        kind: 'iap',
        reason: LedgerReasons.charge(pack),
        refId: newId,
        idempotencyKey: `iap:${dto.store}:${transactionId}`.slice(0, 255),
      });
      return {
        credits: entry.balanceAfter,
        granted: pack.credits,
        alreadyProcessed: false,
        entry: toLedgerEntry(entry),
      };
    });

    if (dto.store === 'play' && purchaseToken) {
      await this.consumePlay(transactionId, pack.productId, purchaseToken);
    }
    return result;
  }

  /** AdMob SSV 콜백. 서명이 맞으면 광고 보상을 준다 (중복·하루 3회 초과는 조용히 무시) */
  async handleAdmobSsv(rawQuery: string): Promise<void> {
    const p = await this.admob.verify(rawQuery);
    const result = await this.wallet.grantAdReward(p.userId, p.transactionId);
    if (result !== 'granted') {
      this.logger.log(`광고 보상 지급 안 함 (${result}): ${p.transactionId}`);
    }
  }

  /** App Store Server Notifications V2. 환불(REFUND·REVOKE)이면 회수한다 */
  async handleAppleNotification(signedPayload: string): Promise<void> {
    if (!this.appStore.available())
      throw new AppException('BILLING_NOTIFICATIONS_UNAVAILABLE');
    const n = await this.appStore.verifyNotification(signedPayload);
    await this.dataSource.manager.insert(BillingEvent, {
      source: 'app_store',
      eventType: n.subtype
        ? `${n.notificationType}:${n.subtype}`
        : n.notificationType,
      transactionId: n.transaction?.transactionId ?? null,
      payload: n as unknown as object,
    });
    if (APPLE_REFUND_TYPES.has(n.notificationType) && n.transaction) {
      await this.refund('app_store', n.transaction.transactionId);
    }
  }

  /** Google Play RTDN (Pub/Sub 푸시). 환불(voidedPurchaseNotification)이면 회수한다 */
  async handlePlayRtdn(
    authorization: string | undefined,
    data: string | undefined,
  ) {
    await this.play.verifyPushToken(authorization);
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(
        Buffer.from(data ?? '', 'base64').toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      this.logger.warn('RTDN 본문을 읽지 못했습니다');
    }
    const voided = payload.voidedPurchaseNotification as
      { orderId?: string } | undefined;
    const eventType = voided
      ? 'voidedPurchase'
      : payload.oneTimeProductNotification
        ? 'oneTimeProduct'
        : payload.testNotification
          ? 'test'
          : 'other';
    await this.dataSource.manager.insert(BillingEvent, {
      source: 'play',
      eventType,
      transactionId: voided?.orderId ?? null,
      payload,
    });
    if (voided?.orderId) await this.refund('play', voided.orderId);
  }

  /**
   * 환불 처리. 충전한 크레딧을 잔액 안에서 회수한다(잔액은 음수가 되지 않는다).
   * 이미 써서 회수하지 못한 만큼은 unrecovered_credits에 남긴다.
   */
  async refund(store: IapStore, transactionId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const purchase = await m
        .createQueryBuilder(IapPurchase, 'p')
        .setLock('pessimistic_write')
        .where('p.store = :store AND p.transaction_id = :transactionId', {
          store,
          transactionId,
        })
        .getOne();
      if (!purchase || purchase.status === 'refunded') return;

      let recovered = 0;
      if (purchase.userId) {
        const user = await m
          .createQueryBuilder(User, 'u')
          .setLock('pessimistic_write')
          .where('u.id = :id', { id: purchase.userId })
          .getOne();
        recovered = Math.min(user?.credits ?? 0, purchase.credits);
        if (recovered > 0) {
          const pack = findCreditPack(purchase.productId);
          await this.wallet.apply(m, {
            userId: purchase.userId,
            delta: -recovered,
            kind: 'refund',
            reason: pack
              ? LedgerReasons.chargeRefund(pack)
              : '크레딧 충전 취소',
            refId: purchase.id,
            idempotencyKey: `refund:${store}:${transactionId}`.slice(0, 255),
          });
        }
      }
      await m.update(IapPurchase, purchase.id, {
        status: 'refunded',
        refundedAt: new Date(),
        unrecoveredCredits: purchase.credits - recovered,
      });
      this.logger.warn(
        `환불 처리 ${store}:${transactionId} 회수 ${recovered}/${purchase.credits}`,
      );
    });
  }

  /** consume이 안 된 Play 결제를 다시 consume한다 (정리 작업) */
  async retryPlayConsumes(): Promise<number> {
    if (!this.play.available()) return 0;
    const pending = await this.dataSource.manager.find(IapPurchase, {
      where: { store: 'play', consumedAt: IsNull(), status: 'granted' },
      take: 50,
    });
    for (const p of pending) {
      if (p.purchaseToken)
        await this.consumePlay(p.transactionId, p.productId, p.purchaseToken);
    }
    return pending.length;
  }

  private async consumePlay(
    transactionId: string,
    productId: string,
    token: string,
  ) {
    try {
      await this.play.consume(productId, token);
      await this.dataSource.manager.update(
        IapPurchase,
        { store: 'play', transactionId },
        { consumedAt: new Date() },
      );
    } catch (e) {
      // 지급은 끝났다. 정리 작업이 다시 시도한다
      this.logger.error(`Play consume 실패 ${transactionId}: ${String(e)}`);
    }
  }
}
