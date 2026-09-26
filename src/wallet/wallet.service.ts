import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { decodeCursor, encodeCursor } from '../common/utils/cursor.js';
import { kstDate } from '../common/utils/kst.js';
import { Block } from '../friends/entities/block.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  AD_DAILY_LIMIT,
  AD_REWARD_CREDITS,
  GIFT_AMOUNTS,
  LedgerReasons,
} from '../shop/products.js';
import { User } from '../users/entities/user.entity.js';
import { LedgerEntryResponse, WalletResponse } from './dto/wallet.response.js';
import { AdReward } from './entities/ad-reward.entity.js';
import { CreditLedger, LedgerKind } from './entities/credit-ledger.entity.js';

export interface CreditChange {
  userId: string;
  /** +는 지급, −는 차감 */
  delta: number;
  kind: LedgerKind;
  /** 크레딧 내역에 보이는 문구 */
  reason: string;
  refId?: string | null;
  idempotencyKey?: string | null;
  /** 원장 시각 (개발 시드용). 없으면 now() */
  createdAt?: Date;
}

const UNNAMED = '이름 없음';

export function toLedgerEntry(l: CreditLedger): LedgerEntryResponse {
  return {
    id: l.id,
    delta: l.delta,
    reason: l.reason,
    kind: l.kind,
    createdAt: l.createdAt.toISOString(),
  };
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 잔액을 바꾸고 원장에 한 줄 남긴다. 호출하는 쪽의 트랜잭션(manager) 안에서 부른다.
   * 차감은 `credits + delta >= 0`일 때만 되는 조건부 UPDATE라 동시에 와도 음수가 되지 않는다.
   */
  async apply(
    manager: EntityManager,
    change: CreditChange,
  ): Promise<CreditLedger> {
    const result = await manager
      .createQueryBuilder()
      .update(User)
      .set({ credits: () => 'credits + :delta' })
      .where('id = :userId AND credits + :delta >= 0')
      .setParameters({ delta: change.delta, userId: change.userId })
      .returning(['credits'])
      .execute();

    const rows = result.raw as { credits: number }[];
    if (rows.length === 0) {
      const user = await manager.findOne(User, {
        where: { id: change.userId },
        select: { id: true, credits: true },
      });
      if (!user) throw new AppException('USER_NOT_FOUND');
      throw new AppException('INSUFFICIENT_CREDITS', {
        need: -change.delta - user.credits,
      });
    }

    return manager.save(
      manager.create(CreditLedger, {
        userId: change.userId,
        delta: change.delta,
        balanceAfter: rows[0].credits,
        kind: change.kind,
        reason: change.reason,
        refId: change.refId ?? null,
        idempotencyKey: change.idempotencyKey ?? null,
        ...(change.createdAt ? { createdAt: change.createdAt } : {}),
      }),
    );
  }

  async getWallet(userId: string): Promise<WalletResponse> {
    const user = await this.dataSource.manager.findOneBy(User, { id: userId });
    if (!user) throw new AppException('USER_NOT_FOUND');
    const used = await this.adRewardsToday(this.dataSource.manager, userId);
    return {
      credits: user.credits,
      ads: {
        rewardPerView: AD_REWARD_CREDITS,
        dailyLimit: AD_DAILY_LIMIT,
        remainingToday: Math.max(0, AD_DAILY_LIMIT - used),
      },
    };
  }

  async listLedger(
    userId: string,
    cursor: string | undefined,
    limit = 30,
  ): Promise<{ items: LedgerEntryResponse[]; nextCursor: string | null }> {
    const qb = this.dataSource.manager
      .createQueryBuilder(CreditLedger, 'l')
      .where('l.user_id = :userId', { userId })
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      const c = decodeCursor(cursor);
      qb.andWhere('(l.created_at, l.id) < (:at, :id)', {
        at: new Date(c.at),
        id: c.id,
      });
    }
    const rows = await qb.getMany();
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map(toLedgerEntry),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  /**
   * 크레딧 선물. 한 트랜잭션에서 내 원장 −, 상대 원장 + 두 줄.
   * 친구에게만, 어느 쪽이든 차단 관계면 거절한다.
   */
  async gift(
    fromId: string,
    toId: string,
    amount: number,
    idempotencyKey: string | null,
  ): Promise<{ credits: number; entry: LedgerEntryResponse }> {
    if (!(GIFT_AMOUNTS as readonly number[]).includes(amount)) {
      throw new AppException('INVALID_GIFT_AMOUNT');
    }
    if (fromId === toId) throw new AppException('GIFT_NOT_ALLOWED');

    const { entry, fromName } = await this.dataSource.transaction(async (m) => {
      const friendship = await m.findOneBy(Friendship, {
        userId: fromId,
        friendId: toId,
      });
      if (!friendship) throw new AppException('FRIEND_NOT_FOUND');
      const blocked = await m
        .createQueryBuilder(Block, 'b')
        .where(
          '(b.user_id = :a AND b.blocked_id = :b) OR (b.user_id = :b AND b.blocked_id = :a)',
          { a: fromId, b: toId },
        )
        .getExists();
      if (blocked) throw new AppException('GIFT_NOT_ALLOWED');

      // 서로에게 동시에 선물해도 교착되지 않게 id 순서로 잠근다
      const users = await m
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id IN (:...ids)', { ids: [fromId, toId] })
        .orderBy('u.id', 'ASC')
        .getMany();
      const from = users.find((u) => u.id === fromId);
      const to = users.find((u) => u.id === toId);
      if (!from || !to) throw new AppException('USER_NOT_FOUND');
      const fromName = from.name ?? UNNAMED;

      const entry = await this.apply(m, {
        userId: fromId,
        delta: -amount,
        kind: 'gift_sent',
        reason: LedgerReasons.giftSent(to.name ?? UNNAMED),
        refId: toId,
        idempotencyKey,
      });
      await this.apply(m, {
        userId: toId,
        delta: amount,
        kind: 'gift_received',
        reason: LedgerReasons.giftReceived(fromName),
        refId: fromId,
        idempotencyKey,
      });
      return { entry, fromName };
    });

    this.notifications
      .giftReceived({
        recipientId: toId,
        senderId: fromId,
        senderName: fromName,
        amount,
      })
      .catch((e: unknown) => this.logger.error(`푸시 실패: ${String(e)}`));
    return { credits: entry.balanceAfter, entry: toLedgerEntry(entry) };
  }

  /**
   * 광고 보상 지급 (AdMob SSV 콜백, 개발용 /dev/credits).
   * 같은 transactionId는 한 번만, 한국 시간 하루 3회까지. 결과만 돌려주고 예외는 던지지 않는다.
   */
  async grantAdReward(
    userId: string,
    transactionId: string,
  ): Promise<'granted' | 'duplicate' | 'limit' | 'unknown_user'> {
    return this.dataSource.transaction(async (m) => {
      const user = await m
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();
      if (!user) return 'unknown_user';
      if (await m.existsBy(AdReward, { transactionId })) return 'duplicate';
      if ((await this.adRewardsToday(m, userId)) >= AD_DAILY_LIMIT)
        return 'limit';

      await m.insert(AdReward, {
        transactionId,
        userId,
        rewardDate: kstDate(),
      });
      await this.apply(m, {
        userId,
        delta: AD_REWARD_CREDITS,
        kind: 'ad_reward',
        reason: LedgerReasons.adReward,
        idempotencyKey: `ad:${transactionId}`.slice(0, 255),
      });
      return 'granted';
    });
  }

  private adRewardsToday(m: EntityManager, userId: string): Promise<number> {
    return m.countBy(AdReward, { userId, rewardDate: kstDate() });
  }
}
