import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { WalletService } from '../src/wallet/wallet.service.js';
import { createApp, devLogin } from './utils.js';

describe('WalletService (e2e, 실제 DB)', () => {
  let app: INestApplication<App>;
  let wallet: WalletService;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createApp();
    wallet = app.get(WalletService);
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());

  it('잔액보다 많이 차감하면 INSUFFICIENT_CREDITS(need)이고 아무것도 바뀌지 않는다', async () => {
    const { user } = await devLogin(app, '지갑'); // 가입 선물 10
    await expect(
      ds.transaction((m) =>
        wallet.apply(m, {
          userId: user.id,
          delta: -30,
          kind: 'tape_purchase',
          reason: '1분 테이프 구매',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      response: { need: 20 },
    });

    const entry = await ds.transaction((m) =>
      wallet.apply(m, {
        userId: user.id,
        delta: -10,
        kind: 'tape_purchase',
        reason: '테스트',
      }),
    );
    expect(entry.balanceAfter).toBe(0);
    const [{ credits }] = await ds.query(
      'SELECT credits FROM users WHERE id = $1',
      [user.id],
    );
    expect(credits).toBe(0);
  });

  it('동시에 차감해도 잔액이 음수가 되지 않는다', async () => {
    const { user } = await devLogin(app, '동시');
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        ds.transaction((m) =>
          wallet.apply(m, {
            userId: user.id,
            delta: -4,
            kind: 'tape_purchase',
            reason: '테스트',
          }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const [{ credits }] = await ds.query(
      'SELECT credits FROM users WHERE id = $1',
      [user.id],
    );
    expect(credits).toBe(2);
  });
});
