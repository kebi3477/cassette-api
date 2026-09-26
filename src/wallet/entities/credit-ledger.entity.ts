import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** 크레딧 증감 종류. 앱은 `reason` 문구를 그대로 보여 주고, 분기는 `kind`로 한다 */
export const LEDGER_KINDS = [
  'signup_gift',
  'ad_reward',
  'iap',
  'tape_purchase',
  'drawer_expand',
  'gift_sent',
  'gift_received',
  'refund',
  'admin',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** 크레딧 원장. 잔액이 바뀔 때마다 한 줄씩 쌓고, 고치거나 지우지 않는다 */
@Entity('credit_ledger')
@Unique('UQ_credit_ledger_user_idempotency', ['userId', 'idempotencyKey'])
@Index('IDX_credit_ledger_user_created', ['userId', 'createdAt'])
export class CreditLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** +는 받음, −는 씀 */
  @Column({ type: 'integer' })
  delta: number;

  /** 이 줄을 반영한 뒤의 잔액 */
  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 32 })
  kind: LedgerKind;

  /** 크레딧 내역에 보이는 문구. 예: "가입 선물", "1분 테이프 구매", "지현님이 선물" */
  @Column({ type: 'varchar', length: 64 })
  reason: string;

  /** 관련 레코드 id (구매, 선물 상대 등) */
  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
