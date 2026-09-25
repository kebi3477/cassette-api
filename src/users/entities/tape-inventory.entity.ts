import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity.js';

/** 사서 쓰는 테이프 종류. 1분 테이프는 무제한 무료라 재고가 없다 */
export const PAID_TAPE_TYPES = [3, 5] as const;
export type PaidTapeType = (typeof PAID_TAPE_TYPES)[number];

@Entity('tape_inventory')
@Check('CHK_tape_inventory_type', '"tape_type" IN (3, 5)')
@Check('CHK_tape_inventory_qty_non_negative', '"qty" >= 0')
export class TapeInventory {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'tape_type', type: 'smallint' })
  tapeType: PaidTapeType;

  @Column({ type: 'integer', default: 0 })
  qty: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;
}
