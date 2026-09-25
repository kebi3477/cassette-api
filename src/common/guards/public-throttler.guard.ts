import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * 공개 엔드포인트 요청 횟수 제한 (IP 기준). auth, 링크 웹 페이지, 웹 재생 API에 붙인다.
 * Cloudflare Tunnel 뒤라서 trust proxy로 X-Forwarded-For의 IP를 쓴다.
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const cf = (
      req.headers as Record<string, string | undefined> | undefined
    )?.['cf-connecting-ip'];
    return Promise.resolve(cf ?? (req.ip as string) ?? 'unknown');
  }
}
