import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { JobsService } from '../src/jobs/jobs.service.js';
import {
  bearer,
  befriend,
  createApp,
  devLogin,
  fcm,
  idem,
  kakaoMock,
  readyRecording,
  storage,
  uniqueKey,
} from './utils.js';

describe('notifications · 정리 작업 · 탈퇴 연결 해제 (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createApp();
    ds = app.get<DataSource>(getDataSourceToken());
  });
  afterAll(() => app.close());

  it('테이프 도착·링크 받음 푸시, 무효 토큰 정리, 기기 해제', async () => {
    const a = await devLogin(app, '하늘');
    const b = await devLogin(app, '민경');
    await befriend(app, a, b);
    await request(server())
      .put('/api/notifications/devices')
      .set(bearer(b.accessToken))
      .send({ token: 'token-b-valid-000001', platform: 'android' })
      .expect(204);
    await request(server())
      .put('/api/notifications/devices')
      .set(bearer(b.accessToken))
      .send({ token: 'token-b-dead-0000001', platform: 'ios' })
      .expect(204);
    fcm.invalidTokens.add('token-b-dead-0000001');
    fcm.sent = [];

    const rec = await readyRecording(app, a.accessToken, 1);
    const sent = await request(server())
      .post('/api/deliveries')
      .set(bearer(a.accessToken))
      .set(idem())
      .send({ recordingId: rec, recipientId: b.user.id })
      .expect(201);
    await vi.waitFor(() =>
      expect(fcm.sent).toContainEqual({
        token: 'token-b-valid-000001',
        title: '하늘님이 테이프를 보냈어요',
        body: '1분 테이프가 도착했어요. 뜯어서 들어보세요',
        data: { type: 'tape', deliveryId: sent.body.id },
      }),
    );
    await vi.waitFor(async () => {
      const rows = await ds.query(
        'SELECT token FROM device_tokens WHERE user_id = $1',
        [b.user.id],
      );
      expect(rows).toEqual([{ token: 'token-b-valid-000001' }]);
    });

    // 링크를 받으면 보낸 사람에게
    await request(server())
      .put('/api/notifications/devices')
      .set(bearer(a.accessToken))
      .send({ token: 'token-a-000000000001', platform: 'ios' })
      .expect(204);
    const c = await devLogin(app, '유진');
    const rec2 = await readyRecording(app, a.accessToken, 1);
    const link = await request(server())
      .post('/api/deliveries')
      .set(bearer(a.accessToken))
      .set(idem())
      .send({ recordingId: rec2, linkName: '유진' })
      .expect(201);
    const token = (link.body.share.url as string).split('/t/')[1];
    await request(server())
      .post(`/api/share/${token}/claim`)
      .set(bearer(c.accessToken))
      .set(idem())
      .expect(200);
    await vi.waitFor(() =>
      expect(fcm.sent).toContainEqual(
        expect.objectContaining({
          token: 'token-a-000000000001',
          title: '유진님이 테이프를 받았어요',
          body: '이제 서로 친구예요',
        }),
      ),
    );

    await request(server())
      .delete('/api/notifications/devices/token-b-valid-000001')
      .set(bearer(b.accessToken))
      .expect(204);
    const rows = await ds.query(
      'SELECT token FROM device_tokens WHERE user_id = $1',
      [b.user.id],
    );
    expect(rows).toEqual([]);
  });

  it('정리 작업: 24시간 지난 멱등 키, 1시간 넘게 uploading인 녹음(파일 포함)', async () => {
    const u = await devLogin(app, '정리');
    const jobs = app.get(JobsService);
    await ds.query(
      `INSERT INTO idempotency_keys (user_id, key, method, path, request_hash, created_at)
       VALUES ($1, 'old-key-000001', 'POST', '/x', 'h', now() - interval '25 hours'),
              ($1, 'new-key-000001', 'POST', '/x', 'h', now())`,
      [u.user.id],
    );
    expect(await jobs.cleanupIdempotencyKeys()).toBeGreaterThanOrEqual(1);
    const keys = await ds.query(
      'SELECT key FROM idempotency_keys WHERE user_id = $1',
      [u.user.id],
    );
    expect(keys).toEqual([{ key: 'new-key-000001' }]);

    const created = await request(server())
      .post('/api/recordings')
      .set(bearer(u.accessToken))
      .send({ tapeType: 1, durationMs: 3000, contentType: 'audio/mp4' })
      .expect(201);
    const key = storage.keyOf(created.body.upload.url);
    storage.put(key, Buffer.from('half'));
    await ds.query(
      `UPDATE recordings SET created_at = now() - interval '2 hours' WHERE id = $1`,
      [created.body.id],
    );
    expect(await jobs.cleanupStaleUploads()).toBeGreaterThanOrEqual(1);
    await request(server())
      .get(`/api/recordings/${created.body.id}`)
      .set(bearer(u.accessToken))
      .expect(404);
    expect(storage.objects.has(key)).toBe(false);
  });

  it('탈퇴하면 카카오 연결 끊기를 부르고, 실패해도 탈퇴는 된다', async () => {
    const sub = `k-${uniqueKey()}`;
    kakaoMock.verify.mockResolvedValueOnce({
      sub,
      email: null,
      nickname: null,
    });
    const login = await request(server())
      .post('/api/auth/kakao')
      .send({ accessToken: 'x' })
      .expect(200);
    kakaoMock.unlink.mockRejectedValueOnce(new Error('카카오 장애'));
    await request(server())
      .delete('/api/users/me')
      .set(bearer(login.body.accessToken))
      .expect(204);
    expect(kakaoMock.unlink).toHaveBeenCalledWith(sub);
    await request(server())
      .get('/api/users/me')
      .set(bearer(login.body.accessToken))
      .expect(401);
  });
});
