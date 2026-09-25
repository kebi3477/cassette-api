import { Injectable, Logger } from '@nestjs/common';
import { verify } from 'node:crypto';
import { AppException } from '../common/errors/app.exception.js';

export const ADMOB_KEYS_URL =
  'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEYS_TTL_MS = 24 * 60 * 60 * 1000;

export interface SsvParams {
  transactionId: string;
  userId: string;
  rewardAmount: number;
  adUnit: string;
}

/**
 * AdMob 보상형 광고 서버 측 확인(SSV) 서명 검증.
 * 서명 대상은 쿼리 문자열에서 `&signature=` 앞부분 전체이고, 서명은 ECDSA(SHA-256) DER을 web-safe base64로 적은 것이다.
 */
@Injectable()
export class AdmobService {
  private readonly logger = new Logger(AdmobService.name);
  private cache: { keys: Map<string, string>; at: number } | null = null;

  /** 공개 키 목록을 가져온다. 테스트에서는 이 함수를 바꿔 테스트 키를 넣는다 */
  keySource: () => Promise<Map<string, string>> = async () => {
    const res = await fetch(ADMOB_KEYS_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`AdMob 키를 받지 못했습니다: ${res.status}`);
    const body = (await res.json()) as {
      keys: { keyId: number | string; pem: string }[];
    };
    return new Map(body.keys.map((k) => [String(k.keyId), k.pem]));
  };

  /** @param rawQuery `?` 뒤의 원래 쿼리 문자열 (디코딩하지 않은 그대로) */
  async verify(rawQuery: string): Promise<SsvParams> {
    const at = rawQuery.indexOf('&signature=');
    if (at < 0) throw new AppException('INVALID_SIGNATURE');
    const message = rawQuery.slice(0, at);
    const params = new URLSearchParams(rawQuery);
    const signature = params.get('signature');
    const keyId = params.get('key_id');
    if (!signature || !keyId) throw new AppException('INVALID_SIGNATURE');

    let pem = (await this.keys(false)).get(keyId);
    if (!pem) pem = (await this.keys(true)).get(keyId); // 키가 바뀌었을 수 있다
    if (!pem) throw new AppException('INVALID_SIGNATURE');

    const ok = verify(
      'sha256',
      Buffer.from(message),
      pem,
      Buffer.from(signature, 'base64url'),
    );
    if (!ok) throw new AppException('INVALID_SIGNATURE');

    const transactionId = params.get('transaction_id');
    const userId = params.get('user_id');
    if (!transactionId || !userId) throw new AppException('VALIDATION_FAILED');
    return {
      transactionId,
      userId,
      rewardAmount: Number(params.get('reward_amount') ?? 0),
      adUnit: params.get('ad_unit') ?? '',
    };
  }

  private async keys(refresh: boolean): Promise<Map<string, string>> {
    if (!refresh && this.cache && Date.now() - this.cache.at < KEYS_TTL_MS) {
      return this.cache.keys;
    }
    try {
      const keys = await this.keySource();
      this.cache = { keys, at: Date.now() };
      return keys;
    } catch (e) {
      this.logger.error(String(e));
      if (this.cache) return this.cache.keys;
      throw new AppException('BILLING_NOTIFICATIONS_UNAVAILABLE');
    }
  }
}
