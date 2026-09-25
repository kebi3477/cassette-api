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

export const IAP_STORES = ['app_store', 'play'] as const;
export type IapStore = (typeof IAP_STORES)[number];

/**
 * 인앱 결제(크레딧 충전) 기록. (store, transaction_id)가 UNIQUE라 같은 결제로 두 번 지급하지 않는다.
 * 전자상거래법상 보관을 위해 탈퇴해도 지우지 않고 user_id만 NULL로 끊는다.
 */
@Entity('iap_purchases')
@Unique('UQ_iap_purchases_store_transaction', ['store', 'transactionId'])
export class IapPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  store: IapStore;

  /** App Store transactionId / Google Play orderId */
  @Column({ name: 'transaction_id', type: 'varchar', length: 128 })
  transactionId: string;

  @Column({ name: 'product_id', type: 'varchar', length: 64 })
  productId: string;

  @Index('IDX_iap_purchases_user_id')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'integer' })
  credits: number;

  /** Google Play 구매 토큰 (consume에 필요) */
  @Column({ name: 'purchase_token', type: 'text', nullable: true })
  purchaseToken: string | null;

  /** App Store 환경 (Production / Sandbox) */
  @Column({ type: 'varchar', length: 16, nullable: true })
  environment: string | null;

  /** granted: 지급함 · refunded: 환불됨 */
  @Column({ type: 'varchar', length: 16, default: 'granted' })
  status: 'granted' | 'refunded';

  /** Google Play consume 완료 시각. 비어 있으면 정리 작업이 다시 시도한다 */
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  /** 환불 때 잔액이 모자라 회수하지 못한 크레딧 */
  @Column({ name: 'unrecovered_credits', type: 'integer', default: 0 })
  unrecoveredCredits: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
