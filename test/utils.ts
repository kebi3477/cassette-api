import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { KakaoService } from '../src/auth/kakao.service.js';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';

export const kakaoMock = { verify: vi.fn() };

export async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KakaoService)
    .useValue(kakaoMock)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: ['error', 'warn'],
  });
  setupApp(app);
  await app.init();
  return app;
}

export function uniqueKey(prefix = 'u'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function devLogin(
  app: INestApplication<App>,
  name?: string,
  key = uniqueKey(),
): Promise<AuthResponse> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/dev')
    .send(name ? { key, name } : { key })
    .expect(200);
  return res.body as AuthResponse;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
