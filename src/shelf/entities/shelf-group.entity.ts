import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export const GROUP_NAME_MAX_LENGTH = 12;

/** 서랍의 칸. 순서는 fractional index(position, COLLATE "C") */
@Entity('shelf_groups')
@Index('IDX_shelf_groups_user_position', ['userId', 'position'])
export class ShelfGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: GROUP_NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: 64, collation: 'C' })
  position: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
