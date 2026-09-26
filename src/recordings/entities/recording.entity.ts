import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** 테이프 종류 코드 = 녹음 한도(초). 15초·1분·3분 */
export const TAPE_TYPES = [15, 60, 180] as const;
export type TapeType = (typeof TAPE_TYPES)[number];
/** 무료·무제한 테이프 (재고 없음) */
export const FREE_TAPE_TYPE = 15 satisfies TapeType;

export const RECORDING_STATUSES = [
  'uploading',
  'processing',
  'ready',
  'failed',
] as const;
export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

/**
 * 녹음 파일. 앱이 원본(raw)을 presigned PUT으로 올리면 워커가 "테이프 소리"로 바꿔 processed에 둔다.
 * 보낸 사람이 탈퇴해도 받은 사람의 테이프는 남아야 해서 owner_id는 SET NULL이다.
 */
@Entity('recordings')
@Check('CHK_recordings_tape_type', '"tape_type" IN (15, 60, 180)')
@Check('CHK_recordings_duration_positive', '"duration_ms" > 0')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_recordings_owner_id')
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'tape_type', type: 'smallint' })
  tapeType: TapeType;

  /** 앱이 알린 길이, 변환 후에는 실제 파일 길이 */
  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @Column({ type: 'varchar', length: 16, default: 'uploading' })
  status: RecordingStatus;

  @Column({ name: 'content_type', type: 'varchar', length: 64 })
  contentType: string;

  @Column({ name: 'raw_key', type: 'varchar', length: 255 })
  rawKey: string;

  @Column({
    name: 'processed_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  processedKey: string | null;

  /** 변환 실패 이유 (로그용, 앱에는 주지 않는다) */
  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  failureReason: string | null;

  /** 파일을 지운 시각 (테이프를 지우거나 탈퇴해서) */
  /**
   * 원본(raw) 파일을 지운 시각. 변환이 성공(ready)하면 원본은 필요 없어서 지운다(개인정보 최소화).
   * 지우기에 실패하면 비어 있고, 정리 작업이 다시 지운다
   */
  @Column({ name: 'raw_deleted_at', type: 'timestamptz', nullable: true })
  rawDeletedAt: Date | null;

  @Column({ name: 'purged_at', type: 'timestamptz', nullable: true })
  purgedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner?: Relation<User>;
}
