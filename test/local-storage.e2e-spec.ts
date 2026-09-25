import { INestApplication } from '@nestjs/common';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';

// AppModule을 불러오기 전에 설정한다: 로컬 저장소 드라이버 + ffmpeg passthrough (실제 구현 사용)
const env = vi.hoisted(() => {
  const port = 3917;
  const saved = {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    FFMPEG_MODE: process.env.FFMPEG_MODE,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    LOCAL_STORAGE_DIR: process.env.LOCAL_STORAGE_DIR,
  };
  process.env.STORAGE_DRIVER = 'local';
  process.env.FFMPEG_MODE = 'passthrough';
  process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${port}`;
  return { port, saved };
});

const { bearer, befriend, createApp, devLogin, idem, waitForStatus } =
  await import('./utils.js');

describe('로컬 저장소 드라이버 + passthrough (실제 HTTP): 업로드 → complete → ready → 보내기 → 뜯기 → 재생', () => {
  let app: INestApplication<App>;
  const dir = mkdtempSync(join(tmpdir(), 'cassette-local-'));
  const base = `http://127.0.0.1:${env.port}`;

  beforeAll(async () => {
    process.env.LOCAL_STORAGE_DIR = dir;
    app = await createApp({
      realStorage: true,
      realFfmpeg: true,
      port: env.port,
    });
  });
  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
    // 같은 워커에서 도는 다른 테스트 파일에 새지 않게 되돌린다
    for (const [k, v] of Object.entries(env.saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('앱과 같은 방식(upload.url + headers로 PUT, preview.url·audio url로 GET)으로 동작한다', async () => {
    const a = await devLogin(app, '보냄');
    const b = await devLogin(app, '받음');
    await befriend(app, a, b);
    const audio = Buffer.from('ID3-fake-m4a-bytes-'.repeat(100));

    const created = await request(app.getHttpServer())
      .post('/api/recordings')
      .set(bearer(a.accessToken))
      .send({ tapeType: 1, durationMs: 4321, contentType: 'audio/mp4' })
      .expect(201);
    const upload = created.body.upload as {
      url: string;
      headers: Record<string, string>;
    };
    expect(upload.url.startsWith(`${base}/api/dev-storage/`)).toBe(true);

    // 서명이 틀리거나 Content-Type이 다르면 거절
    const tampered = upload.url.replace(
      /sig=[0-9a-f]+/,
      'sig=' + '0'.repeat(64),
    );
    expect(
      (
        await fetch(tampered, {
          method: 'PUT',
          headers: upload.headers,
          body: audio,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/aac' },
          body: audio,
        })
      ).status,
    ).toBe(403);

    const put = await fetch(upload.url, {
      method: 'PUT',
      headers: upload.headers,
      body: audio,
    });
    expect(put.status).toBe(200);

    await request(app.getHttpServer())
      .post(`/api/recordings/${created.body.id}/complete`)
      .set(bearer(a.accessToken))
      .expect(200);
    const ready = await waitForStatus(
      app,
      a.accessToken,
      created.body.id,
      'ready',
    );
    expect(ready.durationMs).toBe(4321); // passthrough는 앱이 알린 길이
    const preview = await fetch((ready.preview as { url: string }).url);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-type')).toContain('audio/mp4');
    expect(Buffer.from(await preview.arrayBuffer()).equals(audio)).toBe(true);

    const sent = await request(app.getHttpServer())
      .post('/api/deliveries')
      .set(bearer(a.accessToken))
      .set(idem())
      .send({ recordingId: created.body.id, recipientId: b.user.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/deliveries/${sent.body.id}/open`)
      .set(bearer(b.accessToken))
      .expect(200);
    const url = await request(app.getHttpServer())
      .get(`/api/deliveries/${sent.body.id}/audio`)
      .set(bearer(b.accessToken))
      .expect(200);
    const played = await fetch(url.body.url, {
      headers: { Range: 'bytes=0-9' },
    });
    expect(played.status).toBe(206);
    expect(Buffer.from(await played.arrayBuffer()).toString()).toBe(
      'ID3-fake-m',
    );

    // 만료된 서명은 거절
    const expired = (url.body.url as string).replace(/exp=\d+/, 'exp=1');
    expect((await fetch(expired)).status).toBe(403);
  });
});
