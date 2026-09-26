import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { JobsService } from '../src/jobs/jobs.service.js';
import { bearer, clock, createApp, devLogin, idem } from './utils.js';

const DAY = 86_400_000;

describe('결제 기록 5년 보관 뒤 파기 (e2e, 시계 주입)', () => {
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

  const buy = async (name: string) => {
    const u = await devLogin(app, name);
    const tx = `apple-ret-${name}-${Date.now()}`;
    await request(server())
      .post('/api/billing/iap')
      .set(bearer(u.accessToken))
      .set(idem())
      .send({
        store: 'app_store',
        productId: 'tapeletter.credits_100',
        verificationData: JSON.stringify({
          transactionId: tx,
          productId: 'tapeletter.credits_100',
        }),
      })
      .expect(200);
    return { u, tx };
  };
  const exists = async (tx: string) =>
    Number(
      (
        await ds.query(
          'SELECT count(*)::int AS n FROM iap_purchases WHERE transaction_id = $1',
          [tx],
        )
      )[0].n,
    ) === 1;

  it('탈퇴로 연결이 끊긴 결제 기록과 스토어 알림 기록만 5년 뒤 지운다', async () => {
    const leaver = await buy('떠남');
    const stayer = await buy('남음');
    await request(server())
      .delete('/api/users/me')
      .set(bearer(leaver.u.accessToken))
      .expect(204);
    await ds.query(
      `INSERT INTO billing_events (source, event_type, transaction_id, payload) VALUES ('app_store', 'REFUND', $1, '{}')`,
      [leaver.tx],
    );

    const jobs = app.get(JobsService);
    // 4년 364일 뒤: 아직 보관
    clock.offsetMs = (5 * 365 - 1) * DAY;
    await jobs['billing'].purgeExpiredPaymentRecords();
    expect(await exists(leaver.tx)).toBe(true);

    // 5년 하고 이틀 뒤: 탈퇴한 사람의 결제 기록과 알림 기록은 삭제, 회원인 사람의 기록은 유지
    clock.offsetMs = (5 * 366 + 2) * DAY;
    const removed = await jobs['billing'].purgeExpiredPaymentRecords();
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await exists(leaver.tx)).toBe(false);
    expect(await exists(stayer.tx)).toBe(true);
    const events = await ds.query(
      'SELECT count(*)::int AS n FROM billing_events WHERE transaction_id = $1',
      [leaver.tx],
    );
    expect(events[0].n).toBe(0);
  });
});
