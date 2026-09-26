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
 * 차단. 차단한 사람이 보낸 테이프·선물은 받지 않는다.
 * 해제하면 차단 전에 친구였던 경우에만 친구 목록으로 되돌린다.
 */
@Entity('blocks')
@Check('CHK_blocks_not_self', '"user_id" <> "blocked_id"')
export class Block {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('IDX_blocks_blocked_id')
  @PrimaryColumn({ name: 'blocked_id', type: 'uuid' })
  blockedId: string;

  /** 차단할 때 친구였는지 */
  @Column({ name: 'was_friend', type: 'boolean', default: false })
  wasFriend: boolean;

  /** 차단할 때의 즐겨찾기·마지막 주고받은 시각 (해제 시 복원) */
  @Column({ name: 'friend_starred', type: 'boolean', default: false })
  friendStarred: boolean;

  /** 차단할 때의 별명 (해제 시 복원) */
  @Column({
    name: 'friend_nickname',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  friendNickname: string | null;

  @Column({ name: 'friend_last_at', type: 'timestamptz', nullable: true })
  friendLastAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked?: Relation<User>;
}
