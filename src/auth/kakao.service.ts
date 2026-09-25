import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception.js';
import { SocialProfile } from './social-profile.js';

const KAPI = 'https://kapi.kakao.com';
const TIMEOUT_MS = 5000;

interface TokenInfo {
  id: number;
  app_id: number;
  expires_in: number;
}

interface KakaoUser {
  id: number;
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    profile?: { nickname?: string };
  };
}

/**
 * 카카오 액세스 토큰 검증.
 * 1) access_token_info로 토큰이 살아 있는지, 우리 앱(KAKAO_APP_ID)에서 발급됐는지 확인하고
 * 2) user/me로 회원번호·닉네임·이메일을 가져온다.
 */
@Injectable()
export class KakaoService {
  private readonly logger = new Logger(KakaoService.name);

  constructor(private readonly config: ConfigService) {}

  async verify(accessToken: string): Promise<SocialProfile> {
    const info = await this.call<TokenInfo>(
      '/v1/user/access_token_info',
      accessToken,
    );
    const appId = this.config.get<string>('KAKAO_APP_ID');
    if (appId && String(info.app_id) !== appId) {
      this.logger.warn(`다른 앱의 카카오 토큰: app_id=${info.app_id}`);
      throw new AppException('SOCIAL_TOKEN_INVALID');
    }
    const me = await this.call<KakaoUser>('/v2/user/me', accessToken);
    if (me.id !== info.id) throw new AppException('SOCIAL_TOKEN_INVALID');

    const account = me.kakao_account;
    const emailOk = account?.is_email_valid && account?.is_email_verified;
    return {
      sub: String(me.id),
      email: emailOk ? (account?.email ?? null) : null,
      nickname: account?.profile?.nickname ?? null,
    };
  }

  private async call<T>(path: string, accessToken: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${KAPI}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.error(`카카오 API 호출 실패 ${path}: ${String(e)}`);
      throw new AppException('SOCIAL_PROVIDER_UNAVAILABLE');
    }
    if (res.status === 401 || res.status === 400) {
      throw new AppException('SOCIAL_TOKEN_INVALID');
    }
    if (!res.ok) {
      this.logger.error(`카카오 API 오류 ${path}: ${res.status}`);
      throw new AppException('SOCIAL_PROVIDER_UNAVAILABLE');
    }
    return (await res.json()) as T;
  }
}
