import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { RejoinService } from '../src/auth/rejoin.service.js';
import {
  bearer,
  clock,
  createApp,
  devLogin,
  kakaoMock,
  uniqueKey,
} from './utils.js';

const DAY = 86_400_000;

describe('탈퇴 후 재가입 제한 (e2e, 시계 주입)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createApp();
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());
  afterEach(() => {
    clock.offsetMs = 0;
  });

  const kakaoLogin = (sub: string) => {
    kakaoMock.verify.mockResolvedValueOnce({
      sub,
      email: null,
      nickname: null,
    });
    return request(server()).post('/api/auth/kakao').send({ accessToken: 'x' });
  };
  const withdraw = (accessToken: string) =>
    request(server())
      .delete('/api/users/me')
      .set(bearer(accessToken))
      .expect(204);

  it('탈퇴 → 30일 안 재가입 거절(403, availableAt) → 30일 뒤 재가입 성공, 가입 선물 다시 지급', async () => {
    const sub = `kakao-${uniqueKey()}`;
    const first = await kakaoLogin(sub).expect(200);
    expect(first.body.isNewUser).toBe(true);
    const withdrawnAt = Date.now();
    await withdraw(first.body.accessToken);

    // 원문 식별자는 남기지 않는다 (해시와 시각만)
    const rows: { identity_hash: string }[] = await ds.query(
      'SELECT identity_hash FROM withdrawn_identities',
    );
    expect(rows.some((r) => r.identity_hash.includes(sub))).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.identity_hash))).toBe(
      true,
    );

    const blocked = await kakaoLogin(sub).expect(403);
    expect(blocked.body).toMatchObject({
      code: 'REJOIN_RESTRICTED',
      message: '탈퇴 후 30일 동안은 다시 가입할 수 없어요',
    });
    const availableAt = Date.parse(blocked.body.availableAt);
    expect(Math.abs(availableAt - (withdrawnAt + 30 * DAY))).toBeLessThan(
      10_000,
    );

    clock.offsetMs = 29 * DAY;
    await kakaoLogin(sub).expect(403);

    clock.offsetMs = 30 * DAY + 60_000;
    const again = await kakaoLogin(sub).expect(200);
    expect(again.body.isNewUser).toBe(true);
    expect(again.body.user.id).not.toBe(first.body.user.id);
    expect(again.body.user.credits).toBe(10);
    const ledger = await request(server())
      .get('/api/wallet/ledger')
      .set(bearer(again.body.accessToken))
      .expect(200);
    expect(ledger.body.items).toEqual([
      expect.objectContaining({
        kind: 'signup_gift',
        reason: '가입 선물',
        delta: 10,
      }),
    ]);
  });

  it('다른 계정은 영향이 없다: 기존 계정 로그인, 다른 새 계정 가입, 개발 로그인', async () => {
    const existing = `kakao-${uniqueKey()}`;
    await kakaoLogin(existing).expect(200);

    const leaver = `kakao-${uniqueKey()}`;
    const l = await kakaoLogin(leaver).expect(200);
    await withdraw(l.body.accessToken);

    const relogin = await kakaoLogin(existing).expect(200);
    expect(relogin.body.isNewUser).toBe(false);
    const fresh = await kakaoLogin(`kakao-${uniqueKey()}`).expect(200);
    expect(fresh.body.isNewUser).toBe(true);

    // 개발 로그인에는 적용하지 않는다
    const key = uniqueKey('dev');
    const d = await devLogin(app, '개발', key);
    await withdraw(d.accessToken);
    const dAgain = await devLogin(app, '개발', key);
    expect(dAgain.isNewUser).toBe(true);
  });

  it('정리 작업: 기간이 지난 기록만 지운다', async () => {
    const oldSub = `kakao-${uniqueKey()}`;
    const o = await kakaoLogin(oldSub).expect(200);
    await withdraw(o.body.accessToken);
    const count = async () =>
      Number(
        (
          await ds.query('SELECT count(*)::int AS n FROM withdrawn_identities')
        )[0].n,
      );
    const before = await count();

    // 정리 작업(jobs/ 매시간)이 부르는 함수
    const rejoin = app.get(RejoinService);
    // 아직 30일 안: 지우지 않는다
    expect(await rejoin.cleanupExpired()).toBe(0);
    expect(await count()).toBe(before);

    // 31일 뒤: 기간이 지난 기록을 지운다
    clock.offsetMs = 31 * DAY;
    const removed = await rejoin.cleanupExpired();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await count()).toBe(0);
    // 기록이 지워져도 30일이 지났으니 가입 가능
    await kakaoLogin(oldSub).expect(200);
  });
});
