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

export const REPORT_TARGET_TYPES = ['tape', 'user'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'harassment',
  'sexual',
  'spam',
  'illegal',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = [
  'received',
  'reviewed',
  'actioned',
  'dismissed',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * 신고. 테이프를 신고해도 녹음 파일은 복사하지 않는다(운영자는 필요할 때 기존 데이터를 조회한다).
 * 신고자가 탈퇴하면 reporter_id만 NULL로 끊고 처리 이력으로 3년 보관한다(정리 작업이 삭제).
 * target_id·tape_sender_id는 FK가 아니다: 대상이 탈퇴하거나 테이프를 지워도 신고 기록은 남는다.
 */
@Entity('reports')
@Index('IDX_reports_reporter_created', ['reporterId', 'createdAt'])
@Index('IDX_reports_reporter_target', ['reporterId', 'targetType', 'targetId'])
@Index('IDX_reports_status_created', ['status', 'createdAt'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reporter_id', type: 'uuid', nullable: true })
  reporterId: string | null;

  @Column({ name: 'target_type', type: 'varchar', length: 8 })
  targetType: ReportTargetType;

  /** tape: deliveries.id · user: users.id */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /** 테이프 신고일 때 그 테이프를 보낸 사람 (보낸 사람이 탈퇴한 테이프면 NULL) */
  @Column({ name: 'tape_sender_id', type: 'uuid', nullable: true })
  tapeSenderId: string | null;

  @Column({ type: 'varchar', length: 16 })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 300, nullable: true })
  memo: string | null;

  @Column({ type: 'varchar', length: 12, default: 'received' })
  status: ReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_id' })
  reporter?: Relation<User>;
}
