import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, SignJWT } from 'jose';
import {
  parseEncryptionKey,
  TokenCipher,
} from '../common/utils/token-cipher.js';

const APPLE = 'https://appleid.apple.com';

/**
 * Sign in with Apple 서버 연동: authorization code → refresh token 교환(저장), 탈퇴할 때 토큰 철회.
 * client_secret은 .p8 키로 서명한 ES256 JWT다. 키가 없으면 건너뛰고 로그만 남긴다.
 */
@Injectable()
export class AppleSignInService {
  private readonly logger = new Logger(AppleSignInService.name);
  readonly cipher: TokenCipher;

  constructor(private readonly config: ConfigService) {
    const key = parseEncryptionKey(
      config.getOrThrow<string>('TOKEN_ENCRYPTION_KEY'),
    );
    if (!key)
      throw new Error('TOKEN_ENCRYPTION_KEY는 32바이트 base64여야 합니다');
    this.cipher = new TokenCipher(key);
  }

  private get clientId(): string | undefined {
    return (
      (this.config.get<string>('APPLE_CLIENT_IDS') ?? '')
        .split(',')[0]
        ?.trim() || undefined
    );
  }

  available(): boolean {
    return !!(
      this.config.get<string>('APPLE_TEAM_ID') &&
      this.config.get<string>('APPLE_SIGN_IN_KEY_ID') &&
      this.config.get<string>('APPLE_SIGN_IN_PRIVATE_KEY') &&
      this.clientId
    );
  }

  /** authorization code를 refresh token으로 바꿔 암호화해 돌려준다. 실패하면 null */
  async exchangeCode(code: string): Promise<string | null> {
    if (!this.available()) return null;
    try {
      const body = await this.post('/auth/token', {
        code,
        grant_type: 'authorization_code',
      });
      const token = (body as { refresh_token?: string }).refresh_token;
      return token ? this.cipher.encrypt(token) : null;
    } catch (e) {
      this.logger.warn(`Apple 코드 교환 실패: ${String(e)}`);
      return null;
    }
  }

  /** 탈퇴: 저장해 둔 refresh token을 철회한다 */
  async revoke(encryptedRefreshToken: string | null): Promise<void> {
    if (!this.available()) {
      this.logger.warn('Apple 키가 없어 토큰 철회를 건너뜁니다');
      return;
    }
    const token = encryptedRefreshToken
      ? this.cipher.decrypt(encryptedRefreshToken)
      : null;
    if (!token) {
      this.logger.warn('저장된 Apple refresh token이 없어 철회를 건너뜁니다');
      return;
    }
    await this.post('/auth/revoke', {
      token,
      token_type_hint: 'refresh_token',
    });
  }

  private async post(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const res = await fetch(`${APPLE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: await this.clientSecret(),
        ...params,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok)
      throw new Error(`Apple ${path} ${res.status}: ${text.slice(0, 200)}`);
    return text ? (JSON.parse(text) as unknown) : {};
  }

  private async clientSecret(): Promise<string> {
    const pem = this.config
      .getOrThrow<string>('APPLE_SIGN_IN_PRIVATE_KEY')
      .replace(/\\n/g, '\n');
    const key = await importPKCS8(pem, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({
        alg: 'ES256',
        kid: this.config.getOrThrow<string>('APPLE_SIGN_IN_KEY_ID'),
      })
      .setIssuer(this.config.getOrThrow<string>('APPLE_TEAM_ID'))
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience(APPLE)
      .setSubject(this.clientId!)
      .sign(key);
  }
}
