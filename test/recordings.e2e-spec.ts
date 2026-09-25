import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '../src/auth/dto/auth.response.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import {
  bearer,
  createApp,
  devLogin,
  ffmpeg,
  storage,
  waitForStatus,
} from './utils.js';

describe('recordings (e2e, 메모리 S3 + 가짜 ffmpeg + 로컬 Redis 큐)', () => {
  let app: INestApplication<App>;
  let me: AuthResponse;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createApp();
    me = await devLogin(app, '녹음');
  });
  afterAll(() => app.close());
  afterEach(() => {
    ffmpeg.durationMs = 4200;
    ffmpeg.fail = false;
  });

  const create = (body: Record<string, unknown>) =>
    request(server())
      .post('/api/recordings')
      .set(bearer(me.accessToken))
      .send(body);

  it('테이프 한도를 넘으면 RECORDING_TOO_LONG (1분 60초 + 1초 오차)', async () => {
    const res = await create({
      tapeType: 1,
      durationMs: 61_001,
      contentType: 'audio/mp4',
    }).expect(400);
    expect(res.body.code).toBe('RECORDING_TOO_LONG');
    await create({
      tapeType: 1,
      durationMs: 61_000,
      contentType: 'audio/mp4',
    }).expect(201);
    await create({
      tapeType: 3,
      durationMs: 180_000,
      contentType: 'audio/mp4',
    }).expect(201);
    const five = await create({
      tapeType: 5,
      durationMs: 302_000,
      contentType: 'audio/mp4',
    }).expect(400);
    expect(five.body.code).toBe('RECORDING_TOO_LONG');
  });

  it('업로드 URL 발급 → 업로드 → complete → 변환 → ready (실제 길이로 갱신, 미리 듣기 URL)', async () => {
    const created = await create({
      tapeType: 3,
      durationMs: 5000,
      contentType: 'audio/mp4',
    }).expect(201);
    expect(created.body).toMatchObject({
      status: 'uploading',
      tapeType: 3,
      durationMs: 5000,
      preview: null,
      upload: { method: 'PUT', headers: { 'Content-Type': 'audio/mp4' } },
    });

    // 올리기 전에 complete하면 UPLOAD_NOT_FOUND
    const early = await request(server())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(me.accessToken))
      .expect(409);
    expect(early.body.code).toBe('UPLOAD_NOT_FOUND');

    storage.put(storage.keyOf(created.body.upload.url), Buffer.from('raw'));
    const completed = await request(server())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(me.accessToken))
      .expect(200);
    expect(['processing', 'ready']).toContain(completed.body.status);

    const ready = await waitForStatus(
      app,
      me.accessToken,
      created.body.id,
      'ready',
    );
    expect(ready.durationMs).toBe(4200);
    expect(ready.preview).toMatchObject({
      url: expect.stringContaining('tape.m4a'),
    });
  });

  it('변환이 끝까지 실패하면 failed → retry로 다시 변환', async () => {
    ffmpeg.fail = true;
    const created = await create({
      tapeType: 1,
      durationMs: 3000,
      contentType: 'audio/mp4',
    }).expect(201);
    storage.put(storage.keyOf(created.body.upload.url), Buffer.from('raw'));
    await request(server())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(me.accessToken))
      .expect(200);
    await waitForStatus(app, me.accessToken, created.body.id, 'failed', 20_000);

    ffmpeg.fail = false;
    await request(server())
      .post(`/api/recordings/${created.body.id}/retry`)
      .set(bearer(me.accessToken))
      .expect(200);
    await waitForStatus(app, me.accessToken, created.body.id, 'ready');
  }, 30_000);

  it('변환 후 실제 길이가 한도를 넘으면 failed', async () => {
    ffmpeg.durationMs = 65_000;
    const created = await create({
      tapeType: 1,
      durationMs: 59_000,
      contentType: 'audio/mp4',
    }).expect(201);
    storage.put(storage.keyOf(created.body.upload.url), Buffer.from('raw'));
    await request(server())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(me.accessToken))
      .expect(200);
    await waitForStatus(app, me.accessToken, created.body.id, 'failed');
  });

  it('남의 녹음은 RECORDING_NOT_FOUND', async () => {
    const created = await create({
      tapeType: 1,
      durationMs: 3000,
      contentType: 'audio/mp4',
    }).expect(201);
    const other = await devLogin(app, '남');
    const res = await request(server())
      .get(`/api/recordings/${created.body.id}`)
      .set(bearer(other.accessToken))
      .expect(404);
    expect(res.body.code).toBe('RECORDING_NOT_FOUND');
  });

  it('변환이 끝나면 원본(raw)을 지운다. 지우기에 실패해도 ready이고 정리 작업이 다시 지운다', async () => {
    const created = await create({
      tapeType: 1,
      durationMs: 3000,
      contentType: 'audio/mp4',
    }).expect(201);
    const rawKey = storage.keyOf(created.body.upload.url);
    storage.put(rawKey, Buffer.from('raw'));
    await request(server())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(me.accessToken))
      .expect(200);
    await waitForStatus(app, me.accessToken, created.body.id, 'ready');
    await vi.waitFor(() => expect(storage.objects.has(rawKey)).toBe(false));
    expect(storage.objects.has(rawKey.replace(/raw$/, 'tape.m4a'))).toBe(true);

    // 삭제 실패: ready는 유지, raw는 남음 → 정리 작업이 지운다
    const second = await create({
      tapeType: 1,
      durationMs: 3000,
      contentType: 'audio/mp4',
    }).expect(201);
    const rawKey2 = storage.keyOf(second.body.upload.url);
    storage.put(rawKey2, Buffer.from('raw'));
    storage.failDelete = true;
    try {
      await request(server())
        .post(`/api/recordings/${second.body.id}/complete`)
        .set(bearer(me.accessToken))
        .expect(200);
      await waitForStatus(app, me.accessToken, second.body.id, 'ready');
      await new Promise((r) => setTimeout(r, 200));
      expect(storage.objects.has(rawKey2)).toBe(true);
    } finally {
      storage.failDelete = false;
    }
    const cleaned = await app.get(JobsService).cleanupReadyRaw();
    expect(cleaned).toBeGreaterThanOrEqual(1);
    expect(storage.objects.has(rawKey2)).toBe(false);
    expect(await app.get(JobsService).cleanupReadyRaw()).toBe(0);
  });
});
