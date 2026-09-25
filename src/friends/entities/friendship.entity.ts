import {
  Check,
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

/**
 * 친구 관계. 방향이 있어서 서로 친구면 두 줄이다.
 * 한쪽이 목록에서 빼거나 차단해도 상대 쪽 줄은 그대로 둔다.
 */
@Entity('friendships')
@Check('CHK_friendships_not_self', '"user_id" <> "friend_id"')
@Index('IDX_friendships_user_order', ['userId', 'starred', 'lastAt'])
export class Friendship {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('IDX_friendships_friend_id')
  @PrimaryColumn({ name: 'friend_id', type: 'uuid' })
  friendId: string;

  @Column({ type: 'boolean', default: false })
  starred: boolean;

  /** 마지막으로 테이프를 주고받은 시각 */
  @Column({ name: 'last_at', type: 'timestamptz', nullable: true })
  lastAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'friend_id' })
  friend?: Relation<User>;
}
