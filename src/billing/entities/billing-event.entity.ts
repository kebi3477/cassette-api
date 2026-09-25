import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 스토어 서버 알림 기록 (App Store Server Notifications V2, Google Play RTDN) */
@Entity('billing_events')
export class BillingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** app_store · play */
  @Column({ type: 'varchar', length: 16 })
  source: string;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType: string;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  transactionId: string | null;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
