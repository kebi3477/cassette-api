import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** 광고 보상 (AdMob SSV). transaction_id가 PK라 같은 콜백으로 두 번 지급하지 않는다 */
@Entity('ad_rewards')
@Index('IDX_ad_rewards_user_date', ['userId', 'rewardDate'])
export class AdReward {
  @PrimaryColumn({ name: 'transaction_id', type: 'varchar', length: 128 })
  transactionId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** 한국 시간 기준 날짜 (하루 3회 제한) */
  @Column({ name: 'reward_date', type: 'date' })
  rewardDate: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
