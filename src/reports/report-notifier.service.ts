import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Report } from './entities/report.entity.js';

/**
 * 운영자에게 신고 알리기. 이메일 인프라가 없어서
 * 1) 서버 로그에 warn (신고 ID, 사유, 대상 유형만. 개인정보는 넣지 않는다)
 * 2) REPORT_WEBHOOK_URL이 있으면 JSON POST (슬랙 `text`, 디스코드 `content` 둘 다 넣는다)
 * 실패해도 신고는 성공으로 둔다.
 */
@Injectable()
export class ReportNotifierService {
  private readonly logger = new Logger(ReportNotifierService.name);

  constructor(private readonly config: ConfigService) {}

  async notify(
    report: Pick<Report, 'id' | 'reason' | 'targetType' | 'createdAt'>,
  ) {
    const summary = `[신고] id=${report.id} reason=${report.reason} target=${report.targetType}`;
    this.logger.warn(summary);

    const url = this.config.get<string>('REPORT_WEBHOOK_URL');
    if (!url) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: summary,
          content: summary,
          report: {
            id: report.id,
            reason: report.reason,
            targetType: report.targetType,
            createdAt: report.createdAt.toISOString(),
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok)
        this.logger.warn(`신고 웹훅 실패 ${res.status} (id=${report.id})`);
    } catch (e) {
      this.logger.warn(`신고 웹훅 실패 (id=${report.id}): ${String(e)}`);
    }
  }
}
