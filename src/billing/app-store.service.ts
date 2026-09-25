import {
  Environment,
  SignedDataVerifier,
  VerificationException,
} from '@apple/app-store-server-library';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppException } from '../common/errors/app.exception.js';

const APPLE_ROOT_CERT_URLS = [
  'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer',
  'https://www.apple.com/certificateauthority/AppleIncRootCertificate.cer',
];

export interface AppStoreTransaction {
  transactionId: string;
  productId: string;
  environment: string;
  revoked: boolean;
}

export interface AppStoreNotification {
  notificationType: string;
  subtype: string | null;
  transaction: AppStoreTransaction | null;
}

function decodeJwsPayload(jws: string): Record<string, unknown> {
  const part = jws.split('.')[1];
  if (!part) throw new AppException('RECEIPT_INVALID');
  try {
    return JSON.parse(
      Buffer.from(part, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    throw new AppException('RECEIPT_INVALID');
  }
}

/**
 * App Store 서명 데이터(JWS) 검증. StoreKit 2의 jwsRepresentation과 서버 알림 V2를 Apple 인증서 체인으로 확인한다.
 * APPLE_BUNDLE_ID가 없으면 503 IAP_UNAVAILABLE. 테스트에서는 목으로 바꾼다.
 */
@Injectable()
export class AppStoreService {
  private readonly logger = new Logger(AppStoreService.name);
  private rootCerts: Promise<Buffer[]> | null = null;

  constructor(private readonly config: ConfigService) {}

  available(): boolean {
    return !!this.config.get<string>('APPLE_BUNDLE_ID');
  }

  async verifyTransaction(jws: string): Promise<AppStoreTransaction> {
    const verifier = await this.verifierFor(decodeJwsPayload(jws).environment);
    try {
      const t = await verifier.verifyAndDecodeTransaction(jws);
      return toTransaction(t);
    } catch (e) {
      if (e instanceof VerificationException)
        throw new AppException('RECEIPT_INVALID');
      throw e;
    }
  }

  async verifyNotification(
    signedPayload: string,
  ): Promise<AppStoreNotification> {
    const payload = decodeJwsPayload(signedPayload);
    const env = (payload.data as { environment?: string } | undefined)
      ?.environment;
    const verifier = await this.verifierFor(env);
    try {
      const n = await verifier.verifyAndDecodeNotification(signedPayload);
      const signed = n.data?.signedTransactionInfo;
      return {
        notificationType: String(n.notificationType ?? ''),
        subtype: n.subtype ? String(n.subtype) : null,
        transaction: signed
          ? toTransaction(await verifier.verifyAndDecodeTransaction(signed))
          : null,
      };
    } catch (e) {
      if (e instanceof VerificationException)
        throw new AppException('INVALID_SIGNATURE');
      throw e;
    }
  }

  private async verifierFor(envClaim: unknown): Promise<SignedDataVerifier> {
    const bundleId = this.config.get<string>('APPLE_BUNDLE_ID');
    if (!bundleId) throw new AppException('IAP_UNAVAILABLE');
    const sandbox = envClaim === Environment.SANDBOX;
    if (sandbox && !this.config.get<boolean>('APPLE_IAP_ALLOW_SANDBOX')) {
      throw new AppException('RECEIPT_INVALID');
    }
    const appAppleId = this.config.get<number>('APPLE_APP_APPLE_ID');
    if (!sandbox && !appAppleId) {
      this.logger.error(
        'APPLE_APP_APPLE_ID가 없어 운영 영수증을 확인할 수 없습니다',
      );
      throw new AppException('IAP_UNAVAILABLE');
    }
    const certs = await this.loadRootCerts();
    return new SignedDataVerifier(
      certs,
      true,
      sandbox ? Environment.SANDBOX : Environment.PRODUCTION,
      bundleId,
      appAppleId,
    );
  }

  private loadRootCerts(): Promise<Buffer[]> {
    this.rootCerts ??= (async () => {
      const dir = this.config.get<string>('APPLE_ROOT_CERTS_DIR');
      if (dir) {
        const files = (await readdir(dir)).filter((f) => f.endsWith('.cer'));
        return Promise.all(files.map((f) => readFile(join(dir, f))));
      }
      return Promise.all(
        APPLE_ROOT_CERT_URLS.map(async (url) => {
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (!res.ok)
            throw new Error(`Apple 루트 인증서를 받지 못했습니다: ${url}`);
          return Buffer.from(await res.arrayBuffer());
        }),
      );
    })().catch((e: unknown) => {
      this.rootCerts = null;
      this.logger.error(String(e));
      throw new AppException('IAP_UNAVAILABLE');
    });
    return this.rootCerts;
  }
}

function toTransaction(t: {
  transactionId?: string;
  productId?: string;
  environment?: string;
  revocationDate?: number;
}): AppStoreTransaction {
  if (!t.transactionId || !t.productId)
    throw new AppException('RECEIPT_INVALID');
  return {
    transactionId: t.transactionId,
    productId: t.productId,
    environment: String(t.environment ?? ''),
    revoked: !!t.revocationDate,
  };
}
