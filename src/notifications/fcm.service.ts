import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';
import {
  parseServiceAccount,
  ServiceAccount,
} from '../common/utils/service-account.js';

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

/** 보낸 결과. invalid면 그 토큰을 지운다 */
export type PushResult = 'sent' | 'invalid' | 'failed' | 'disabled';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/**
 * FCM HTTP v1 발송. FCM_SERVICE_ACCOUNT_JSON이 없으면 보내지 않고 로그만 남긴다('disabled').
 * 테스트에서는 목으로 바꾼다.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly account: ServiceAccount | null;
  private readonly client: JWT | null;

  constructor(config: ConfigService) {
    this.account = parseServiceAccount(
      config.get<string>('FCM_SERVICE_ACCOUNT_JSON'),
    );
    this.client = this.account
      ? new JWT({
          email: this.account.client_email,
          key: this.account.private_key,
          scopes: [SCOPE],
        })
      : null;
    if (!this.account)
      this.logger.warn(
        'FCM_SERVICE_ACCOUNT_JSON이 없어 푸시는 로그만 남깁니다',
      );
  }

  async send(token: string, message: PushMessage): Promise<PushResult> {
    if (!this.client || !this.account) {
      this.logger.log(`[푸시 생략] ${message.title} / ${message.body}`);
      return 'disabled';
    }
    const { token: accessToken } = await this.client.getAccessToken();
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'HIGH' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) return 'sent';
    const text = await res.text();
    // 앱이 지워졌거나 토큰이 바뀜 → 정리
    if (
      res.status === 404 ||
      text.includes('UNREGISTERED') ||
      text.includes('INVALID_ARGUMENT')
    ) {
      return 'invalid';
    }
    this.logger.error(`FCM 실패 ${res.status}: ${text.slice(0, 300)}`);
    return 'failed';
  }
}
