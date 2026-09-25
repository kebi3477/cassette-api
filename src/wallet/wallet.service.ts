import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { User } from '../users/entities/user.entity.js';
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
}

@Injectable()
export class WalletService {
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
      }),
    );
  }
}
