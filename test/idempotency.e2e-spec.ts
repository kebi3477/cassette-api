import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { IdempotencyService } from '../src/common/services/idempotency.service.js';
import { createApp, devLogin } from './utils.js';

describe('IdempotencyService (e2e, 실제 DB)', () => {
  let app: INestApplication<App>;
  let service: IdempotencyService;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
    service = app.get(IdempotencyService);
    userId = (await devLogin(app, '멱등')).user.id;
  });
  afterAll(() => app.close());

  const req = (body: unknown = { amount: 30 }) => ({
    userId,
    key: 'key-idem-0001',
    method: 'POST',
    path: '/api/wallet/gifts',
    body,
  });

  it('선점 → 처리 중 → 완료 후 재생 → 다른 본문은 거절 → abort 후 다시 선점', async () => {
    await expect(service.begin(req())).resolves.toEqual({ kind: 'new' });
    await expect(service.begin(req())).rejects.toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });

    await service.complete(userId, 'key-idem-0001', 201, { credits: 90 });
    await expect(service.begin(req())).resolves.toEqual({
      kind: 'replay',
      status: 201,
      body: { credits: 90 },
    });
    await expect(service.begin(req({ amount: 50 }))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });

    await service.abort(userId, 'key-idem-0001');
    await expect(service.begin(req())).resolves.toEqual({ kind: 'new' });
  });
});
