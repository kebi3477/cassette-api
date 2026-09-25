import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** FCM 등록 토큰. 한 토큰은 마지막으로 등록한 사용자에게만 속한다 */
@Entity('device_tokens')
export class DeviceToken {
  @PrimaryColumn({ type: 'varchar', length: 512 })
  token: string;

  @Index('IDX_device_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  platform: 'ios' | 'android';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
