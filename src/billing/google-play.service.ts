import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT, OAuth2Client } from 'google-auth-library';
import { AppException } from '../common/errors/app.exception.js';
import {
  parseServiceAccount,
  ServiceAccount,
} from '../common/utils/service-account.js';

const API =
  'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export interface PlayProductPurchase {
  orderId: string;
  /** 0 구매됨 · 1 취소됨 · 2 대기 중 */
  purchaseState: number;
  /** 0 아직 consume 안 함 · 1 consume함 */
  consumptionState: number;
}

/**
 * Google Play Developer API: purchases.products.get / consume, RTDN(Pub/Sub 푸시) 인증.
 * 패키지 이름·서비스 계정이 없으면 503 IAP_UNAVAILABLE. 테스트에서는 목으로 바꾼다.
 */
@Injectable()
export class GooglePlayService {
  private readonly logger = new Logger(GooglePlayService.name);
  private readonly account: ServiceAccount | null;
  private readonly packageName: string | undefined;
  private readonly client: JWT | null;
  private readonly oidc = new OAuth2Client();

  constructor(private readonly config: ConfigService) {
    this.account = parseServiceAccount(
      config.get<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
    );
    this.packageName = config.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    this.client = this.account
      ? new JWT({
          email: this.account.client_email,
          key: this.account.private_key,
          scopes: [SCOPE],
        })
      : null;
  }

  available(): boolean {
    return !!this.client && !!this.packageName;
  }

  async getProductPurchase(
    productId: string,
    token: string,
  ): Promise<PlayProductPurchase> {
    const res = await this.call('GET', productId, token);
    if (res.status === 400 || res.status === 404 || res.status === 410) {
      throw new AppException('RECEIPT_INVALID');
    }
    if (!res.ok) {
      this.logger.error(
        `Play 구매 조회 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
      throw new AppException('IAP_UNAVAILABLE');
    }
    const body = (await res.json()) as Partial<PlayProductPurchase>;
    if (!body.orderId) throw new AppException('RECEIPT_INVALID');
    return {
      orderId: body.orderId,
      purchaseState: body.purchaseState ?? 0,
      consumptionState: body.consumptionState ?? 0,
    };
  }

  /** 소비성 상품 consume (acknowledge를 겸한다). 3일 안에 하지 않으면 Google이 환불한다 */
  async consume(productId: string, token: string): Promise<void> {
    const res = await this.call('POST', productId, token, ':consume');
    if (!res.ok) {
      throw new Error(
        `Play consume 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }

  /** Pub/Sub 푸시의 Authorization: Bearer <OIDC 토큰> 확인 */
  async verifyPushToken(authorization: string | undefined): Promise<void> {
    const audience = this.config.get<string>('GOOGLE_RTDN_AUDIENCE');
    if (!audience) throw new AppException('BILLING_NOTIFICATIONS_UNAVAILABLE');
    const [scheme, idToken] = (authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !idToken)
      throw new AppException('INVALID_SIGNATURE');
    try {
      await this.oidc.verifyIdToken({ idToken, audience });
    } catch {
      throw new AppException('INVALID_SIGNATURE');
    }
  }

  private async call(
    method: 'GET' | 'POST',
    productId: string,
    token: string,
    suffix = '',
  ) {
    if (!this.client || !this.packageName)
      throw new AppException('IAP_UNAVAILABLE');
    const { token: accessToken } = await this.client.getAccessToken();
    const url = `${API}/${encodeURIComponent(this.packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}${suffix}`;
    return fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  }
}
