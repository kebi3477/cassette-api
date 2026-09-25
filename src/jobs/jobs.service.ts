import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillingService } from '../billing/billing.service.js';
import { Recording } from '../recordings/entities/recording.entity.js';
import { ShelfService } from '../shelf/shelf.service.js';

export const IDEMPOTENCY_KEY_TTL_HOURS = 24;
export const STALE_UPLOAD_HOURS = 1;

/** 정리 작업 (매시간). JOBS_DISABLED=true면 cron으로는 돌지 않는다 (직접 부를 수는 있다) */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly shelf: ShelfService,
    private readonly billing: BillingService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'hourly-cleanup' })
  async hourly(): Promise<void> {
    if (this.config.get<boolean>('JOBS_DISABLED')) return;
    for (const [name, job] of [
      ['멱등 키', () => this.cleanupIdempotencyKeys()],
      ['방치된 업로드', () => this.cleanupStaleUploads()],
      ['Play consume', () => this.billing.retryPlayConsumes()],
    ] as const) {
      try {
        const n = await job();
        if (n > 0) this.logger.log(`${name} 정리: ${n}건`);
      } catch (e) {
        this.logger.error(`${name} 정리 실패: ${String(e)}`);
      }
    }
  }

  /** 24시간 지난 Idempotency-Key 기록을 지운다 */
  async cleanupIdempotencyKeys(): Promise<number> {
    const result = await this.dataSource.query(
      `DELETE FROM idempotency_keys WHERE created_at < now() - make_interval(hours => $1)`,
      [IDEMPOTENCY_KEY_TTL_HOURS],
    );
    return (result as [unknown, number])[1] ?? 0;
  }

  /** 1시간 넘게 uploading인 녹음(업로드하다 만 것)을 파일과 함께 지운다 */
  async cleanupStaleUploads(): Promise<number> {
    const stale: Pick<Recording, 'id' | 'rawKey' | 'processedKey'>[] =
      await this.dataSource.manager
        .createQueryBuilder(Recording, 'r')
        .select(['r.id', 'r.rawKey', 'r.processedKey'])
        .where(`r.status = 'uploading'`)
        .andWhere('r.created_at < now() - make_interval(hours => :h)', {
          h: STALE_UPLOAD_HOURS,
        })
        .take(500)
        .getMany();
    if (stale.length === 0) return 0;
    await this.dataSource.manager.delete(
      Recording,
      stale.map((r) => r.id),
    );
    await this.shelf.purgeFiles(stale);
    return stale.length;
  }
}
