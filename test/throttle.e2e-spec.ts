import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

// 이 파일만 요청 횟수 제한을 켠다 (AppModule을 불러오기 전에)
const saved = vi.hoisted(() => {
  const before = process.env.THROTTLE_DISABLED;
  process.env.THROTTLE_DISABLED = 'false';
  return before;
});

const { createApp } = await import('./utils.js');

describe('공개 엔드포인트 요청 횟수 제한 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    process.env.THROTTLE_DISABLED = saved ?? 'true';
  });

  it('웹 미리보기는 IP당 1분에 60번, 넘으면 429 RATE_LIMITED', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 60; i++) {
      await request(server)
        .get('/api/share/AAAAAAAAAAAAAAAAAAAAAAAA/web')
        .expect(404);
    }
    const limited = await request(server)
      .get('/api/share/AAAAAAAAAAAAAAAAAAAAAAAA/web')
      .expect(429);
    expect(limited.body).toEqual({
      code: 'RATE_LIMITED',
      message: '잠시 후에 다시 시도해 주세요',
    });
  });

  it('로그인은 1분에 20번', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 20; i++) {
      await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'nope' })
        .expect(401);
    }
    await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'nope' })
      .expect(429);
    // 로그인이 필요한 일반 API에는 걸지 않는다
    await request(server).get('/api/health').expect(200);
  });
});
