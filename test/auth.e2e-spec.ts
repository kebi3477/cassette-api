import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppException } from '../src/common/errors/app.exception.js';
import { bearer, createApp, devLogin, kakaoMock, uniqueKey } from './utils.js';

describe('auth (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());

  it('개발 로그인: 처음이면 가입하고 가입 선물 10 크레딧을 준다', async () => {
    const key = uniqueKey();
    const first = await devLogin(app, '민경', key);
    expect(first.isNewUser).toBe(true);
    expect(first.user).toMatchObject({
      name: '민경',
      credits: 10,
      providers: ['dev'],
    });
    expect(first.accessToken).toBeTruthy();
    expect(first.refreshToken).toBeTruthy();

    const ledger = await ds.query(
      'SELECT delta, balance_after, kind, reason FROM credit_ledger WHERE user_id = $1',
      [first.user.id],
    );
    expect(ledger).toEqual([
      {
        delta: 10,
        balance_after: 10,
        kind: 'signup_gift',
        reason: '가입 선물',
      },
    ]);

    const again = await devLogin(app, undefined, key);
    expect(again.isNewUser).toBe(false);
    expect(again.user.id).toBe(first.user.id);
    expect(again.user.credits).toBe(10);
  });

  it('이름 없이 가입하면 name이 null (이름 정하기 화면)', async () => {
    const res = await devLogin(app);
    expect(res.user.name).toBeNull();
  });

  it('refresh token은 한 번만 쓸 수 있다', async () => {
    const login = await devLogin(app, '하늘');
    const server = app.getHttpServer();
    const r1 = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(200);
    expect(r1.body.refreshToken).not.toBe(login.refreshToken);
    await request(server)
      .get('/api/users/me')
      .set(bearer(r1.body.accessToken))
      .expect(200);

    const reused = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(401);
    expect(reused.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('로그아웃하면 그 refresh token은 더 못 쓴다', async () => {
    const login = await devLogin(app, '민수');
    const server = app.getHttpServer();
    await request(server)
      .post('/api/auth/logout')
      .send({ refreshToken: login.refreshToken })
      .expect(204);
    await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: login.refreshToken })
      .expect(401);
  });

  it('카카오 로그인: 검증 서비스가 준 회원번호로 가입하고 닉네임을 제안한다', async () => {
    kakaoMock.verify.mockResolvedValueOnce({
      sub: `k-${uniqueKey()}`,
      email: null,
      nickname: '카카오닉네임입니다길다',
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/kakao')
      .send({ accessToken: 'kakao-token' })
      .expect(200);
    expect(kakaoMock.verify).toHaveBeenCalledWith('kakao-token');
    expect(res.body).toMatchObject({
      isNewUser: true,
      suggestedName: '카카오닉네임입니',
      user: { name: null, providers: ['kakao'], credits: 10 },
    });
  });

  it('카카오 토큰이 틀리면 401 SOCIAL_TOKEN_INVALID', async () => {
    kakaoMock.verify.mockRejectedValueOnce(
      new AppException('SOCIAL_TOKEN_INVALID'),
    );
    const res = await request(app.getHttpServer())
      .post('/api/auth/kakao')
      .send({ accessToken: 'bad' })
      .expect(401);
    expect(res.body.code).toBe('SOCIAL_TOKEN_INVALID');
  });

  it('Apple 로그인: 가짜 토큰은 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/apple')
      .send({ identityToken: 'not-a-jwt' })
      .expect(401);
    expect(res.body.code).toBe('SOCIAL_TOKEN_INVALID');
  });
});
