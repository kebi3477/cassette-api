import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { KakaoService } from '../src/auth/kakao.service.js';
import { FfmpegService } from '../src/recordings/ffmpeg.service.js';
import { StorageService } from '../src/storage/storage.service.js';
import { AppStoreService } from '../src/billing/app-store.service.js';
import { GooglePlayService } from '../src/billing/google-play.service.js';
import { FcmService } from '../src/notifications/fcm.service.js';
import {
  FakeAppStore,
  FakeFcm,
  FakeFfmpeg,
  FakeGooglePlay,
  InMemoryStorage,
} from './fakes.js';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';

export const kakaoMock = {
  verify: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
};

export const storage = new InMemoryStorage();
export const ffmpeg = new FakeFfmpeg();
export const fcm = new FakeFcm();
export const appStore = new FakeAppStore();
export const googlePlay = new FakeGooglePlay();

export interface CreateAppOptions {
  /** true면 메모리 저장소 대신 설정대로(STORAGE_DRIVER) 실제 드라이버를 쓴다 */
  realStorage?: boolean;
  /** true면 가짜 ffmpeg 대신 FfmpegService(FFMPEG_MODE)를 쓴다 */
  realFfmpeg?: boolean;
  port?: number;
}

export async function createApp(
  opts: CreateAppOptions = {},
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KakaoService)
    .useValue(kakaoMock)
    .overrideProvider(FcmService)
    .useValue(fcm)
    .overrideProvider(AppStoreService)
    .useValue(appStore)
    .overrideProvider(GooglePlayService)
    .useValue(googlePlay);
  if (!opts.realStorage)
    builder = builder.overrideProvider(StorageService).useValue(storage);
  if (!opts.realFfmpeg)
    builder = builder.overrideProvider(FfmpegService).useValue(ffmpeg);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: ['error', 'warn'],
  });
  setupApp(app);
  // 요청마다 임시로 listen/close하지 않게 한 번 띄워 둔다 (supertest의 socket hang up 방지)
  await app.listen(opts.port ?? 0, '127.0.0.1');
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

export const idem = () => ({ 'Idempotency-Key': `k-${randomUUID()}` });

/** 녹음을 만들고 올리고 변환이 끝날 때까지 기다린다 */
export async function readyRecording(
  app: INestApplication<App>,
  accessToken: string,
  tapeType: 1 | 3 | 5 = 1,
  durationMs = 4000,
): Promise<string> {
  const server = app.getHttpServer();
  const created = await request(server)
    .post('/api/recordings')
    .set(bearer(accessToken))
    .send({ tapeType, durationMs, contentType: 'audio/mp4' })
    .expect(201);
  storage.put(
    storage.keyOf(created.body.upload.url),
    Buffer.from('fake-audio'),
  );
  await request(server)
    .post(`/api/recordings/${created.body.id}/complete`)
    .set(bearer(accessToken))
    .expect(200);
  await waitForStatus(app, accessToken, created.body.id, 'ready');
  return created.body.id as string;
}

export async function waitForStatus(
  app: INestApplication<App>,
  accessToken: string,
  id: string,
  status: string,
  timeoutMs = 8000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app.getHttpServer())
      .get(`/api/recordings/${id}`)
      .set(bearer(accessToken))
      .expect(200);
    if (res.body.status === status) return res.body;
    if (Date.now() > deadline) {
      throw new Error(
        `녹음 ${id} 상태가 ${status}가 되지 않음: ${res.body.status}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** 두 사용자를 서로 친구로 만든다 (개발 API) */
export async function befriend(
  app: INestApplication<App>,
  a: AuthResponse,
  b: AuthResponse,
): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/dev/friends')
    .set(bearer(a.accessToken))
    .send({ userId: b.user.id })
    .expect(201);
}
