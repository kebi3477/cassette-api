import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp } from './utils.js';

describe('공통 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  it('GET /api/health', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' }));

  it('GET /api/app-version: 최소 버전 미달이면 updateRequired', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/app-version?platform=ios&version=0.9.0')
      .expect(200);
    expect(res.body).toMatchObject({
      platform: 'ios',
      minVersion: '1.0.0',
      updateRequired: true,
    });
    expect(res.body.storeUrl).toMatch(/^https:\/\//);
  });

  it('GET /api/app-version: platform이 틀리면 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/app-version?platform=windows')
      .expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: ['platform'],
    });
  });

  it('없는 경로는 { code: NOT_FOUND }', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: '찾을 수 없어요' });
  });

  it('토큰 없이 부르면 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
