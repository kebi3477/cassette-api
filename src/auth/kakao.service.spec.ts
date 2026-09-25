import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception.js';
import { KakaoService } from './kakao.service.js';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('KakaoService', () => {
  const service = new KakaoService(new ConfigService({ KAKAO_APP_ID: '1234' }));
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());

  it('토큰 정보와 사용자 정보를 확인해 프로필을 돌려준다', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, { id: 42, app_id: 1234, expires_in: 100 }),
      )
      .mockResolvedValueOnce(
        json(200, {
          id: 42,
          kakao_account: {
            email: 'a@b.c',
            is_email_valid: true,
            is_email_verified: true,
            profile: { nickname: '민경' },
          },
        }),
      );
    await expect(service.verify('tok')).resolves.toEqual({
      sub: '42',
      email: 'a@b.c',
      nickname: '민경',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://kapi.kakao.com/v1/user/access_token_info',
    );
  });

  it('다른 앱에서 발급한 토큰은 거절한다', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { id: 42, app_id: 9999, expires_in: 100 }),
    );
    await expect(service.verify('tok')).rejects.toMatchObject({
      code: 'SOCIAL_TOKEN_INVALID',
    });
  });

  it('카카오가 401을 주면 SOCIAL_TOKEN_INVALID', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: -401 }));
    await expect(service.verify('bad')).rejects.toBeInstanceOf(AppException);
  });

  it('카카오 서버에 닿지 않으면 SOCIAL_PROVIDER_UNAVAILABLE', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(service.verify('tok')).rejects.toMatchObject({
      code: 'SOCIAL_PROVIDER_UNAVAILABLE',
    });
  });
});
