import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const DEFAULT_DRAWER_CAP = 12;
export const NAME_MAX_LENGTH = 8;

@Entity('users')
@Check('CHK_users_credits_non_negative', '"credits" >= 0')
@Check('CHK_users_drawer_cap_positive', '"drawer_cap" > 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 친구에게 보이는 이름. 가입 직후에는 null이고, 이름 정하기 화면에서 채운다 */
  @Column({ type: 'varchar', length: NAME_MAX_LENGTH, nullable: true })
  name: string | null;

  /** 크레딧 잔액. 증감은 반드시 credit_ledger와 함께 조건부 UPDATE로 한다 */
  @Column({ type: 'integer', default: 0 })
  credits: number;

  /** 서랍 보관 한도 */
  @Column({ name: 'drawer_cap', type: 'integer', default: DEFAULT_DRAWER_CAP })
  drawerCap: number;

  /** 테이프 도착·선물 푸시 알림 */
  @Column({ name: 'notifications_enabled', type: 'boolean', default: true })
  notificationsEnabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
