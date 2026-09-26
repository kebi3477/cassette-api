import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, MoreThan } from 'typeorm';
import { AppException } from '../common/errors/app.exception.js';
import { ClockService } from '../common/services/clock.service.js';
import { Delivery } from '../deliveries/entities/delivery.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';
import { FriendsService } from '../friends/friends.service.js';
import { User } from '../users/entities/user.entity.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { Report, ReportTargetType } from './entities/report.entity.js';
import { ReportNotifierService } from './report-notifier.service.js';

const HOUR_MS = 3_600_000;
/** 같은 대상을 다시 신고해도 새로 만들지 않는 기간 */
export const REPORT_DEDUP_HOURS = 24;
/** 사용자당 24시간 신고 한도 */
export const REPORT_DAILY_LIMIT = 20;
/** 신고 기록 보관 기간(년) */
export const REPORT_RETENTION_YEARS = 3;

export interface ReportResponse {
  id: string;
  createdAt: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly friends: FriendsService,
    private readonly notifier: ReportNotifierService,
    private readonly clock: ClockService,
  ) {}

  /**
   * 신고. 대상 확인 → 24시간 안 같은 대상이면 기존 신고 → 하루 한도 → 저장(+차단)을 한 트랜잭션에서 한다.
   * 같은 사람의 신고는 advisory lock으로 한 줄씩 처리해 한도와 중복 판정이 어긋나지 않게 한다.
   */
  async create(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<ReportResponse> {
    const { report, created } = await this.dataSource.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `report:${reporterId}`,
      ]);
      const target = await this.resolveTarget(m, reporterId, dto);
      const now = this.clock.now();

      const recent = await m.findOne(Report, {
        where: {
          reporterId,
          targetType: target.type,
          targetId: target.id,
          createdAt: MoreThan(
            new Date(now.getTime() - REPORT_DEDUP_HOURS * HOUR_MS),
          ),
        },
        order: { createdAt: 'DESC' },
      });
      if (recent) {
        if (dto.alsoBlock && target.blockUserId) {
          await this.friends.blockInTransaction(
            m,
            reporterId,
            target.blockUserId,
          );
        }
        return { report: recent, created: false };
      }

      const today = await m.countBy(Report, {
        reporterId,
        createdAt: MoreThan(new Date(now.getTime() - 24 * HOUR_MS)),
      });
      if (today >= REPORT_DAILY_LIMIT) throw new AppException('RATE_LIMITED');

      const report = await m.save(
        m.create(Report, {
          reporterId,
          targetType: target.type,
          targetId: target.id,
          tapeSenderId: target.type === 'tape' ? target.blockUserId : null,
          reason: dto.reason,
          memo: dto.memo?.trim() || null,
          status: 'received',
          createdAt: now,
        }),
      );
      if (dto.alsoBlock && target.blockUserId) {
        await this.friends.blockInTransaction(
          m,
          reporterId,
          target.blockUserId,
        );
      }
      return { report, created: true };
    });

    if (created) {
      this.notifier
        .notify(report)
        .catch((e: unknown) =>
          this.logger.error(`신고 알림 실패: ${String(e)}`),
        );
    }
    return { id: report.id, createdAt: report.createdAt.toISOString() };
  }

  /** 정리 작업: 3년 지난 신고 기록을 지운다 */
  async purgeExpired(): Promise<number> {
    const cutoff = this.clock.now();
    cutoff.setFullYear(cutoff.getFullYear() - REPORT_RETENTION_YEARS);
    const result = await this.dataSource.manager.delete(Report, {
      createdAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  /**
   * 신고할 수 있는 대상인지 확인한다.
   * - tape: 내가 받은(서랍에 보이는) 테이프만
   * - user: 나와 친구이거나, 나에게 테이프를 보낸 적이 있는 사람만 (차단한 뒤에도 신고할 수 있다)
   * @returns blockUserId: 함께 차단할 사람 (테이프면 보낸 사람, 탈퇴했으면 null)
   */
  private async resolveTarget(
    m: EntityManager,
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<{
    type: ReportTargetType;
    id: string;
    blockUserId: string | null;
  }> {
    if (dto.target.type === 'tape') {
      const deliveryId = dto.target.deliveryId!;
      const d = await m
        .createQueryBuilder(Delivery, 'd')
        .where('d.id = :deliveryId AND d.recipient_id = :reporterId', {
          deliveryId,
          reporterId,
        })
        .andWhere('d.deleted_at IS NULL AND d.suppressed = false')
        .getOne();
      if (!d) throw new AppException('REPORT_TARGET_NOT_FOUND');
      return { type: 'tape', id: d.id, blockUserId: d.senderId };
    }

    const userId = dto.target.userId!;
    if (userId === reporterId) throw new AppException('CANNOT_REPORT_SELF');
    if (!(await m.existsBy(User, { id: userId }))) {
      throw new AppException('REPORT_TARGET_NOT_FOUND');
    }
    const related =
      (await m.existsBy(Friendship, {
        userId: reporterId,
        friendId: userId,
      })) ||
      (await m.existsBy(Delivery, {
        recipientId: reporterId,
        senderId: userId,
      }));
    if (!related) throw new AppException('REPORT_TARGET_NOT_FOUND');
    return { type: 'user', id: userId, blockUserId: userId };
  }
}
